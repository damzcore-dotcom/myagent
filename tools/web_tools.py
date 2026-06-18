"""Damz Agent — Web Tools.

Tools for web browsing and search.
"""

import webbrowser

try:
    from langchain.tools import tool
except ImportError:
    def tool(func):
        func.is_tool = True
        return func


@tool
def search_web(query: str) -> str:
    """Buka Google Search di browser untuk query tertentu."""
    url = f"https://www.google.com/search?q={query.replace(' ', '+')}"
    webbrowser.open(url)
    return f"Membuka pencarian Google: {query}"


@tool
def open_url(url: str) -> str:
    """Buka URL tertentu di browser default."""
    if not url.startswith("http"):
        url = "https://" + url
    webbrowser.open(url)
    return f"Membuka: {url}"
