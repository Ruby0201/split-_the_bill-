import json
import os
import uuid
import psycopg2
from psycopg2.extras import RealDictCursor

# 資料庫連接
def get_db_connection():
    try:
        conn = psycopg2.connect(
            host=os.environ.get('POSTGRES_HOST'),
            database=os.environ.get('POSTGRES_DATABASE'),
            user=os.environ.get('POSTGRES_USER'),
            password=os.environ.get('POSTGRES_PASSWORD'),
            port=os.environ.get('POSTGRES_PORT', 5432),
            sslmode='require'
        )
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        raise

# 初始化資料庫
def init_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS groups (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                currency VARCHAR(10) NOT NULL DEFAULT 'HKD',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cur.execute('''
            CREATE TABLE IF NOT EXISTS members (
                id VARCHAR(36) PRIMARY KEY,
                group_id VARCHAR(36) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cur.execute('''
            CREATE TABLE IF NOT EXISTS expenses (
                id VARCHAR(36) PRIMARY KEY,
                group_id VARCHAR(36) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                description TEXT NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                payer_id VARCHAR(36) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
                split_type VARCHAR(20) NOT NULL DEFAULT 'equal',
                weights JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Init DB error: {e}")

def handler(request):
    # #region agent log
    import json as json_module
    import time
    try:
        with open('/Users/a60100/Documents/mine/.cursor/debug.log', 'a') as f:
            req_info = {
                'request_type': str(type(request)),
                'is_dict': isinstance(request, dict),
                'request_keys': list(request.keys()) if isinstance(request, dict) else 'not_dict',
                'request_str': str(request)[:500],
                'request_repr': repr(request)[:500]
            }
            f.write(json_module.dumps({'sessionId':'debug-session','runId':'run1','hypothesisId':'A','location':'api/group.py:63','message':'Handler entry','data':req_info,'timestamp':int(time.time()*1000)})+'\n')
    except Exception as log_err: 
        try:
            with open('/Users/a60100/Documents/mine/.cursor/debug.log', 'a') as f:
                f.write(json_module.dumps({'sessionId':'debug-session','runId':'run1','hypothesisId':'A','location':'api/group.py:70','message':'Log error','data':{'error':str(log_err)},'timestamp':int(time.time()*1000)})+'\n')
        except: pass
    # #endregion
    try:
        # Vercel Python runtime 可能使用不同的格式
        # 嘗試多種格式來解析 request
        method = 'GET'
        path = ''
        body = '{}'
        headers = {}
        
        if isinstance(request, dict):
            method = request.get('method', request.get('httpMethod', 'GET')).upper()
            path = request.get('path', request.get('pathname', request.get('url', '')))
            body = request.get('body', request.get('rawBody', '{}'))
            headers = request.get('headers', {})
        elif hasattr(request, '__dict__'):
            # 如果是物件，嘗試取得屬性
            method = getattr(request, 'method', getattr(request, 'httpMethod', 'GET')).upper()
            path = getattr(request, 'path', getattr(request, 'pathname', getattr(request, 'url', '')))
            body = getattr(request, 'body', getattr(request, 'rawBody', '{}'))
            headers = getattr(request, 'headers', {})
        
        # 如果 path 包含查詢參數，移除它們
        if '?' in path:
            path = path.split('?')[0]
    # #region agent log
        try:
            with open('/Users/a60100/Documents/mine/.cursor/debug.log', 'a') as f:
                f.write(json_module.dumps({'sessionId':'debug-session','runId':'run1','hypothesisId':'A','location':'api/group.py:75','message':'Request parsed','data':{'method':method,'path':path,'body_length':len(str(body)),'body_preview':str(body)[:100]},'timestamp':int(time.time()*1000)})+'\n')
        except: pass
    # #endregion
        
        # 解析路徑
        if method == 'GET':
            if path.startswith('/api/group/'):
                group_id = path.replace('/api/group/', '').split('/')[0]
                if group_id:
                    return get_group(group_id)
            return {'statusCode': 404, 'body': json.dumps({'error': 'Not found'})}
        
        elif method == 'POST':
            # #region agent log
            try:
                with open('/Users/a60100/Documents/mine/.cursor/debug.log', 'a') as f:
                    f.write(json.dumps({'sessionId':'debug-session','runId':'run1','hypothesisId':'C','location':'api/group.py:77','message':'POST request path parsing','data':{'path':path,'parts':path.split('/')},'timestamp':int(__import__('time').time()*1000)})+'\n')
            except: pass
            # #endregion
            if path == '/api/group':
                return create_group(body)
            elif '/api/group/' in path and '/member' in path:
                parts = path.split('/')
                group_id = parts[3] if len(parts) > 3 else None
                # #region agent log
                try:
                    with open('/Users/a60100/Documents/mine/.cursor/debug.log', 'a') as f:
                        f.write(json.dumps({'sessionId':'debug-session','runId':'run1','hypothesisId':'C','location':'api/group.py:85','message':'Extracted group_id for member','data':{'group_id':group_id,'parts':parts},'timestamp':int(__import__('time').time()*1000)})+'\n')
                except: pass
                # #endregion
                return add_member(group_id, body)
            elif '/api/group/' in path and '/expense' in path:
                parts = path.split('/')
                group_id = parts[3] if len(parts) > 3 else None
                # #region agent log
                try:
                    with open('/Users/a60100/Documents/mine/.cursor/debug.log', 'a') as f:
                        f.write(json.dumps({'sessionId':'debug-session','runId':'run1','hypothesisId':'C','location':'api/group.py:91','message':'Extracted group_id for expense','data':{'group_id':group_id,'parts':parts},'timestamp':int(__import__('time').time()*1000)})+'\n')
                except: pass
                # #endregion
                return add_expense(group_id, body)
            return {'statusCode': 404, 'body': json.dumps({'error': 'Not found'})}
        
        elif method == 'PUT':
            if path.startswith('/api/group/'):
                group_id = path.replace('/api/group/', '').split('/')[0]
                return update_group(group_id, body)
            return {'statusCode': 404, 'body': json.dumps({'error': 'Not found'})}
        
        elif method == 'DELETE':
            if '/api/group/' in path and '/member/' in path:
                parts = path.split('/')
                group_id = parts[3] if len(parts) > 3 else None
                member_id = parts[5] if len(parts) > 5 else None
                return delete_member(group_id, member_id)
            elif '/api/group/' in path and '/expense/' in path:
                parts = path.split('/')
                group_id = parts[3] if len(parts) > 3 else None
                expense_id = parts[5] if len(parts) > 5 else None
                return delete_expense(group_id, expense_id)
            return {'statusCode': 404, 'body': json.dumps({'error': 'Not found'})}
        
        return {'statusCode': 405, 'body': json.dumps({'error': 'Method not allowed'})}
    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}

def send_json(data, status=200):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(data, ensure_ascii=False)
    }

def create_group(body):
    try:
        init_db()
        data = json.loads(body) if isinstance(body, str) else body
        
        group_id = str(uuid.uuid4())
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            'INSERT INTO groups (id, name, currency) VALUES (%s, %s, %s)',
            (group_id, data['name'], data.get('currency', 'HKD'))
        )
        conn.commit()
        cur.close()
        conn.close()
        
        return send_json({'id': group_id, 'name': data['name'], 'currency': data.get('currency', 'HKD')})
    except Exception as e:
        return send_json({'error': str(e)}, 500)

def get_group(group_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 取得群組
        cur.execute('SELECT * FROM groups WHERE id = %s', (group_id,))
        group = cur.fetchone()
        if not group:
            return send_json({'error': '群組不存在'}, 404)
        
        # 取得成員
        cur.execute('SELECT * FROM members WHERE group_id = %s ORDER BY created_at', (group_id,))
        members = [dict(row) for row in cur.fetchall()]
        
        # 取得費用
        cur.execute('SELECT * FROM expenses WHERE group_id = %s ORDER BY created_at', (group_id,))
        expenses = []
        for row in cur.fetchall():
            exp = dict(row)
            exp['desc'] = exp.pop('description')
            # #region agent log
            try:
                import time
                with open('/Users/a60100/Documents/mine/.cursor/debug.log', 'a') as f:
                    f.write(json.dumps({'sessionId':'debug-session','runId':'run1','hypothesisId':'B','location':'api/group.py:200','message':'Processing expense weights','data':{'weights_type':str(type(exp.get('weights'))),'weights_value':str(exp.get('weights'))[:100]},'timestamp':int(time.time()*1000)})+'\n')
            except: pass
            # #endregion
            weights_val = exp.get('weights')
            if weights_val is None:
                exp['weights'] = []
            elif isinstance(weights_val, str):
                try:
                    exp['weights'] = json.loads(weights_val)
                except Exception as parse_err:
                    # #region agent log
                    try:
                        import time
                        with open('/Users/a60100/Documents/mine/.cursor/debug.log', 'a') as f:
                            f.write(json.dumps({'sessionId':'debug-session','runId':'run1','hypothesisId':'B','location':'api/group.py:210','message':'JSON parse error for weights','data':{'error':str(parse_err),'weights_str':str(weights_val)[:100]},'timestamp':int(time.time()*1000)})+'\n')
                    except: pass
                    # #endregion
                    exp['weights'] = []
            else:
                # psycopg2 會自動將 JSONB 轉換為 Python dict/list
                exp['weights'] = weights_val if isinstance(weights_val, (list, dict)) else []
            expenses.append(exp)
        
        cur.close()
        conn.close()
        
        result = {
            'id': group['id'],
            'name': group['name'],
            'currency': group['currency'],
            'members': members,
            'expenses': expenses
        }
        return send_json(result)
    except Exception as e:
        return send_json({'error': str(e)}, 500)

def update_group(group_id, body):
    try:
        data = json.loads(body) if isinstance(body, str) else body
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            'UPDATE groups SET name = %s, currency = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s',
            (data['name'], data['currency'], group_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        
        return send_json({'success': True})
    except Exception as e:
        return send_json({'error': str(e)}, 500)

def add_member(group_id, body):
    try:
        data = json.loads(body) if isinstance(body, str) else body
        
        member_id = str(uuid.uuid4())
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            'INSERT INTO members (id, group_id, name) VALUES (%s, %s, %s)',
            (member_id, group_id, data['name'])
        )
        conn.commit()
        cur.close()
        conn.close()
        
        return send_json({'id': member_id, 'name': data['name']})
    except Exception as e:
        return send_json({'error': str(e)}, 500)

def delete_member(group_id, member_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('DELETE FROM members WHERE id = %s AND group_id = %s', (member_id, group_id))
        conn.commit()
        cur.close()
        conn.close()
        
        return send_json({'success': True})
    except Exception as e:
        return send_json({'error': str(e)}, 500)

def add_expense(group_id, body):
    try:
        data = json.loads(body) if isinstance(body, str) else body
        
        expense_id = str(uuid.uuid4())
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            '''INSERT INTO expenses (id, group_id, description, amount, payer_id, split_type, weights)
               VALUES (%s, %s, %s, %s, %s, %s, %s)''',
            (expense_id, group_id, data['desc'], data['amount'], data['payerId'], 
             data['splitType'], json.dumps(data.get('weights', [])))
        )
        conn.commit()
        cur.close()
        conn.close()
        
        result = {
            'id': expense_id,
            'desc': data['desc'],
            'amount': float(data['amount']),
            'payerId': data['payerId'],
            'splitType': data['splitType'],
            'weights': data.get('weights', [])
        }
        return send_json(result)
    except Exception as e:
        return send_json({'error': str(e)}, 500)

def delete_expense(group_id, expense_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('DELETE FROM expenses WHERE id = %s AND group_id = %s', (expense_id, group_id))
        conn.commit()
        cur.close()
        conn.close()
        
        return send_json({'success': True})
    except Exception as e:
        return send_json({'error': str(e)}, 500)
