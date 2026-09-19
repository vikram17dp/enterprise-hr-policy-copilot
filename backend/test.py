import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    print("❌ GROQ_API_KEY not found")
    exit()

try:
    client = Groq(api_key=api_key)

    response = client.chat.completions.create(
         model="openai/gpt-oss-120b",
        messages=[
            {
                "role": "user",
                "content": "Say hello in one sentence."
            }
        ],
    )

    print("✅ Groq API key is working!")
    print(response.choices[0].message.content)

except Exception as e:
    print("❌ Groq API request failed")
    print(f"Error: {e}")