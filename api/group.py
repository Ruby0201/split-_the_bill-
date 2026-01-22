import json
import os
import uuid
import psycopg2
from psycopg2.extras import RealDictCursor

# ======================
# Database
# ======================

def get_db_connection():
    return psycopg2.connect(
        host=os.environ.get("POSTGRES_HOST"),
        database=os.environ.get("POSTGRES_DATABASE"),
        user=os.environ.get("POSTGRES_USER"),
        password=os.environ.get("POSTGRES_PASSWORD"),
        port=os.environ.get("POSTGRES_PORT", 5432),
        sslmode="require",
    )

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS groups (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            currency VARCHAR(10) NOT NULL DEFAULT 'HKD',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS members (
            id VARCHAR(36) PRIMARY KEY,
            group_id VARCHAR(36) REFERENCES groups(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            id VARCHAR(36) PRIMARY KEY,
            group_id VARCHAR(36) REFERENCES groups(id) ON DELETE CASCADE,
            description TEXT NOT NULL,
            amount NUMERIC(10,2) NOT NULL,
            payer_id VARCHAR(36) REFERENCES members(id) ON DELETE CASCADE,
            split_type VARCHAR(20) NOT NULL,
            weights JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    cur.close()
    conn.close()

# ======================
# Utils
# ======================

def json_response(data, status=200):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(data, ensure_ascii=False),
    }

def parse_body(body):
    if not body:
        return {}
    return json.loads(body) if isinstance(body, str) else body

# ======================
# Handler
# ======================

def handler(request):
    init_db()

    method = request.get("method", request.get("httpMethod", "GET")).upper()
    path = request.get("path", request.get("url", "")).split("?")[0].rstrip("/")
    body = request.get("body")

    if method == "OPTIONS":
        return json_response({"ok": True})

    segments = path.split("/")

    try:
        # /api/group
        if method == "POST" and path == "/api/group":
            return create_group(body)

        # /api/group/{id}
        if method == "GET" and len(segments) == 4:
            return get_group(segments[3])

        if method == "PUT" and len(segments) == 4:
            return update_group(segments[3], body)

        # /api/group/{id}/member
        if method == "POST" and len(segments) == 5 and segments[4] == "member":
            return add_member(segments[3], body)

        # /api/group/{id}/member/{member_id}
        if method == "DELETE" and len(segments) == 6 and segments[4] == "member":
            return delete_member(segments[3], segments[5])

        # /api/group/{id}/expense
        if method == "POST" and len(segments) == 5 and segments[4] == "expense":
            return add_expense(segments[3], body)

        # /api/group/{id}/expense/{expense_id}
        if method == "DELETE" and len(segments) == 6 and segments[4] == "expense":
            return delete_expense(segments[3], segments[5])

        return json_response({"error": "Not found"}, 404)

    except Exception as e:
        return json_response({"error": str(e)}, 500)

# ======================
# API Implementations
# ======================

def create_group(body):
    data = parse_body(body)
    group_id = str(uuid.uuid4())

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO groups (id, name, currency) VALUES (%s,%s,%s)",
            (group_id, data["name"], data.get("currency", "HKD")),
        )
        conn.commit()
        return json_response({"id": group_id, "name": data["name"]})
    finally:
        cur.close()
        conn.close()

def get_group(group_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT * FROM groups WHERE id=%s", (group_id,))
    group = cur.fetchone()
    if not group:
        return json_response({"error": "群組不存在"}, 404)

    cur.execute("SELECT * FROM members WHERE group_id=%s ORDER BY created_at", (group_id,))
    members = cur.fetchall()

    cur.execute("SELECT * FROM expenses WHERE group_id=%s ORDER BY created_at", (group_id,))
    expenses = []
    for e in cur.fetchall():
        expenses.append({
            "id": e["id"],
            "desc": e["description"],
            "amount": float(e["amount"]),
            "payerId": e["payer_id"],
            "splitType": e["split_type"],
            "weights": e["weights"] or [],
        })

    cur.close()
    conn.close()

    return json_response({
        "id": group["id"],
        "name": group["name"],
        "currency": group["currency"],
        "members": members,
        "expenses": expenses,
    })

def update_group(group_id, body):
    data = parse_body(body)
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE groups SET name=%s, currency=%s WHERE id=%s",
        (data["name"], data["currency"], group_id),
    )
    conn.commit()
    cur.close()
    conn.close()
    return json_response({"success": True})

def add_member(group_id, body):
    data = parse_body(body)
    member_id = str(uuid.uuid4())

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO members (id, group_id, name) VALUES (%s,%s,%s)",
        (member_id, group_id, data["name"]),
    )
    conn.commit()
    cur.close()
    conn.close()

    return json_response({"id": member_id, "name": data["name"]})

def delete_member(group_id, member_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM members WHERE id=%s AND group_id=%s", (member_id, group_id))
    conn.commit()
    cur.close()
    conn.close()
    return json_response({"success": True})

def add_expense(group_id, body):
    data = parse_body(body)
    expense_id = str(uuid.uuid4())

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO expenses
        (id, group_id, description, amount, payer_id, split_type, weights)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
    """, (
        expense_id,
        group_id,
        data["desc"],
        data["amount"],
        data["payerId"],
        data["splitType"],
        json.dumps(data.get("weights", [])),
    ))
    conn.commit()
    cur.close()
    conn.close()

    return json_response({"id": expense_id})

def delete_expense(group_id, expense_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM expenses WHERE id=%s AND group_id=%s",
        (expense_id, group_id),
    )
    conn.commit()
    cur.close()
    conn.close()
    return json_response({"success": True})
