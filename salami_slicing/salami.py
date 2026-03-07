import math

def simulate_salami_slicing(num_transactions=10000):
    hidden_account = 0.0
    total_distributed_to_customers = 0.0
    
    # Let's assume a random interest payment between $0.10 and $0.99
    # with high precision (e.g., $0.55432)
    payments = [0.55432, 0.12871, 0.99123, 0.44339] * (num_transactions // 4)

    for payment in payments:
        # 1. The 'Clean' Cent value (what the customer sees)
        # math.floor chops off everything after the second decimal
        visible_payment = math.floor(payment * 100) / 100
        
        # 2. The 'Salami' Slice (the tiny fraction left over)
        remainder = payment - visible_payment
        
        # 3. Diversion
        total_distributed_to_customers += visible_payment
        hidden_account += remainder

    print(f"Total Transactions: {num_transactions}")
    print(f"Total Paid to Customers: ${total_distributed_to_customers:.2f}")
    print(f"Diverted to Hidden Account: ${hidden_account:.2f}")

simulate_salami_slicing()
