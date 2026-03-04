import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    server_params = StdioServerParameters(
        command="uvx",
        args=["--from", "docling-mcp", "docling-mcp-server", "--transport", "stdio"]
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            print("MCP Server initialized")
            
            # Print tools
            tools = await session.list_tools()
            print("Tools available:")
            for t in tools.tools:
                print(f"- {t.name}: {t.description}")
                
            # Create document
            pdf_path = "docs/IN_23_01062011_TEXTEIS.pdf"
            print(f"Calling create_new_docling_document for {pdf_path}...")
            result = await session.call_tool("create_new_docling_document", arguments={"document_path": pdf_path})
            print(f"Result: {result}")

if __name__ == "__main__":
    asyncio.run(main())
