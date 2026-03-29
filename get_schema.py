import urllib.request
import json

env_file = '.env.local'
url = ''
key = ''

with open(env_file, 'r') as f:
    for line in f:
        if line.startswith('NEXT_PUBLIC_SUPABASE_URL='):
            url = line.split('=')[1].strip()
        if line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
            key = line.split('=')[1].strip()

req = urllib.request.Request(f"{url}/rest/v1/")
req.add_header('apikey', key)
req.add_header('Authorization', f"Bearer {key}")

with urllib.request.urlopen(req) as resp:
    schema = json.loads(resp.read().decode('utf-8'))
    for path, methods in schema.get('paths', {}).items():
        if path.startswith('/rpc/'): continue
        table = path.strip('/')
        if 'get' in methods:
            params = methods['get'].get('parameters', [])
            for p in params:
                name = p.get('name', '')
                if name in ['instructor_id', 'owner_id', 'user_id', 'auth_user_id', 'actor_id', 'created_by', 'target_instructor_id']:
                    print(f"api_update('{table}', f'{name}=eq.{{id}}', {{'{name}': keeper_id}})")
