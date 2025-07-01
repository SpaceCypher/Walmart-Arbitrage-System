from simple_ai_agent import AgentRunner
import json

runner = AgentRunner()

# Test with a specific product that has inventory
inventory_sample = runner.db_manager.db.inventory.find_one({'quantity': {'$gt': 0}})
if inventory_sample:
    test_product_id = inventory_sample['productId']
    print(f'Testing with product: {test_product_id}')
    
    # Check this product's inventory across stores
    all_inventory = list(runner.db_manager.db.inventory.find({'productId': test_product_id}))
    print(f'Found {len(all_inventory)} inventory records for this product')
    for inv in all_inventory[:5]:  # Show first 5
        print(f'  Store {inv["storeId"]}: {inv["quantity"]} units at ${inv["retailPrice"]:.2f}')
    
    print('\n=== Running AI Analysis ===')
    result = runner.run_agent_for_product(test_product_id)
    
    if 'error' in result:
        print(f'Error: {result["error"]}')
    else:
        print(f'Opportunities found: {result["opportunities_found"]}')
        for i, opp in enumerate(result.get('opportunities', [])):
            print(f'\nOpportunity {i+1}:')
            print(f'  Type: {opp["type"]}')
            print(f'  Confidence: {opp["confidence"]:.2f}')
            print(f'  Potential Profit: ${opp["potential_profit"]:.2f}')
            print(f'  From: {opp["source_store"]} → To: {opp["target_store"]}')
            print(f'  Quantity: {opp["quantity"]}')
            print(f'  Reasoning: {opp["reasoning"]}')
            print(f'  Urgency: {opp["urgency"]}')
else:
    print('No products with inventory found')
