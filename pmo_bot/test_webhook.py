import asyncio
from langchain_core.messages import HumanMessage
from modules.agent_graph import app_graph

async def test_agent():
    print("🚀 Directly invoking the Agent Graph to test NER...")
    
    inputs = {
        "messages": [HumanMessage(content="Apliquei 2 litros de calda bordalesa no talhão 3 hoje de manhã cedo.")]
    }
    
    config = {
        "configurable": {
            "thread_id": "ner_test_direct",
            "pmo_context": {
                "user_id": "test",
                "pmo_id": 1
            }
        }
    }
    
    # Run the graph until the 'interpreter' node finishes
    result = await app_graph.ainvoke(inputs, config=config)
    
    print("\n✅ Final State Expected Intent and Slots:")
    print(f"Intent: {result.get('intent')}")
    print(f"Slots: {result.get('slots')}")

if __name__ == "__main__":
    asyncio.run(test_agent())
