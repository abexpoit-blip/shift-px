
import jwt
import sys

def verify_token(token, secret):
    try:
        decoded = jwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
        return True, decoded
    except Exception as e:
        return False, str(e)

secret = "18a2a6262cfb62820f9c5ed7452809ed3469ba0b814b9884417f3bd83889a594"
anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5NTI3MzM4LCJleHAiOjIwOTQ4ODczMzh9.URbRlYz0AjLehmGhVH7dnsfwJPUY_zgYC4hodpxeHW8"
service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8"

print(f"Verifying Anon Key...")
success, data = verify_token(anon_key, secret)
print(f"Result: {success}, Data: {data}")

print(f"\nVerifying Service Role Key...")
success, data = verify_token(service_key, secret)
print(f"Result: {success}, Data: {data}")
