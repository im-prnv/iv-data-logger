import requests
import base64

def get_csv_from_github(repo, path, token):
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    headers = {"Authorization": f"token {token}"}

    response = requests.get(url, headers=headers)
    response.raise_for_status()

    content = response.json()
    decoded = base64.b64decode(content["content"]).decode("utf-8")

    return decoded, content["sha"]


def commit_csv_to_github(repo, path, token, csv_text, sha, message):
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    headers = {"Authorization": f"token {token}"}

    encoded = base64.b64encode(csv_text.encode()).decode()

    payload = {
        "message": message,
        "content": encoded,
        "sha": sha
    }

    response = requests.put(url, json=payload, headers=headers)
    response.raise_for_status()
