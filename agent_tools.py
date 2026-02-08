from tavily import TavilyClient
import os
from dotenv import load_dotenv

load_dotenv()

def web_search_tool(query):
    
    tavily = TavilyClient(api_key = os.getenv("TAVILY_API_KEY"))

    response = tavily.search(query)

    if not response:
        return "No results found"
    
    results = response["results"]
    formatted_results = []
    for i, result in enumerate(results[:5], 1):  # top 5 results
        title = result.get("title", "No title")
        content = result.get("content", "No content")
        url = result.get("url", "No URL")
        
        formatted_results.append(
            f"[{i}] {title}\n"
            f"Content: {content}\n"
            f"Source: {url}\n"
        )
    
    return "\n".join(formatted_results)


print(web_search_tool("Who is Ronaldo and what has he done in his career?")
)



