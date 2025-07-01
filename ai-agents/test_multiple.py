from simple_ai_agent import AgentRunner

runner = AgentRunner()

# Test multiple products
print('Testing AI agent system with multiple products...')
results = runner.run_agents_for_all_products(5)

total_opportunities = 0
total_profit = 0

for result in results:
    if 'error' not in result:
        opportunities = result.get('opportunities_found', 0)
        total_opportunities += opportunities
        product_profit = sum(opp.get('potential_profit', 0) for opp in result.get('opportunities', []))
        total_profit += product_profit
        print(f'{result["product_id"]}: {opportunities} opportunities, ${product_profit:.2f} potential profit')
    else:
        print(f'Error with product: {result["error"]}')

print(f'\nSUMMARY: {total_opportunities} total opportunities found, ${total_profit:.2f} total potential profit')
