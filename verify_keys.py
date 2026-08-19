import os

import jwt
import sys

def verify_token(token, secret):
    try:
        decoded = jwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
        return True, decoded
    except Exception as e:
        return False, str(e)

secret = "18a2a6262cfb62820f9c5ed7452809ed3469ba0b814b9884417f3bd83889a594"
anon_key = os.environ["SUPABASE_ANON_KEY"]
service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

print(f"Verifying Anon Key...")
success, data = verify_token(anon_key, secret)
print(f"Result: {success}, Data: {data}")

print(f"\nVerifying Service Role Key...")
success, data = verify_token(service_key, secret)
print(f"Result: {success}, Data: {data}")
