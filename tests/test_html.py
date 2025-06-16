import pathlib


def test_html_parses_without_errors():
    html_path = pathlib.Path(__file__).resolve().parents[1] / "american-truck-3d.html"
    html_content = html_path.read_text(encoding="utf-8")

    try:
        from bs4 import BeautifulSoup
        BeautifulSoup(html_content, "html.parser")
    except ImportError:
        from html.parser import HTMLParser

        class Parser(HTMLParser):
            """Simple HTML parser that ignores the content."""
            pass

        parser = Parser()
        parser.feed(html_content)

