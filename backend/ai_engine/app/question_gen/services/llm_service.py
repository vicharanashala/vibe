import google.generativeai as genai
import asyncio

async def generate_from_gemini(prompt: str, user_api_key: str) -> str:
    model = genai.GenerativeModel(model_name="gemini-1.5-flash")
    genai.configure(api_key=user_api_key)
    response = await asyncio.to_thread(model.generate_content, prompt)
    await asyncio.sleep(10)  # Rate limiting delay
    return response.text