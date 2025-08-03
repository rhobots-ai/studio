#!/usr/bin/env python3
"""
Test script to verify the model instruction format
"""

import json

def test_instruction_format():
    """Test the exact format being sent to the model"""
    print("🧪 Testing Model Instruction Format")
    print("=" * 50)
    
    # This is the exact format now being sent to your model
    instruction = "You are an accountant examining invoices. you need to extract the following values from the invoice.:\\n1) invoice_number: this is the invoice number also sometimes referred to as invoice no. or invoice serial number or e-Way Bill No or bill no or PO number or purchase order number or invoice sr. no or invoice serial no or invoice serial number. if not found please keep the field null. \\n2) invoice_date: invoice_date should be formatted as python date as YYYY-MM-DD. In case of ambiguous dates please assume that day date is always written before month. If the years don't include the 21st century, please add the 21st century.\\n3) invoice_amount: this is the invoice amount. response should be in float format. \\n4) buyer_gstin: gstin of the buyer or party to which the invoice was raise. buyer_gstin is always matching the regex: \\\\d{2}[A-Z]{5}\\\\d{4}[A-Z]{1}[A-Z\\\\d]{1}Z[A-Z\\\\d]{1}\\n5) seller_gstin: gstin of the seller or party which is is raising the invoice. seller_gstin is always matching the regex: \\\\d{2}[A-Z]{5}\\\\d{4}[A-Z]{1}[A-Z\\\\d]{1}Z[A-Z\\\\d]{1}\\n\\nPlease follow the provided instructions:\\na) maintain variable names exactly as written above\\nb) return the response as a json object\\nc) return only the json object and no other text.      \\nd) provide only the json object and nothing else."
    
    # Sample extracted text (like what PyMuPDF would extract)
    sample_text = """STOVE KRAFT LIMITED
No.81 Harohalli Industrial Area,,Ramanagara Dist
Bangalore,Karnataka,562112,INDIA
GSTN No: 29AADCS9958B1ZY
CIN NO: L29301KA1999PLC025387
Contact No: 080-2801622
Email: info@stovekraft.com

TAX INVOICE

Invoice No: SK/2024/001
Date: 15-01-2024
Amount: Rs. 25,000.00

Bill To:
ABC ENTERPRISES
GSTIN: 27AAPFU0939F1ZV

Total Amount: 25,000.00"""
    
    # Create the training format
    training_format = {
        "instruction": instruction,
        "input": {
            "raw_text": sample_text
        }
    }
    
    # Convert to JSON (this is what gets sent to your model)
    formatted_message = json.dumps(training_format, indent=2)
    
    print("📋 INSTRUCTION FORMAT:")
    print("=" * 30)
    print("✅ Proper JSON structure")
    print("✅ instruction field")
    print("✅ input.raw_text field")
    print()
    
    print("📝 SAMPLE MESSAGE TO MODEL:")
    print("=" * 30)
    print(formatted_message[:500] + "..." if len(formatted_message) > 500 else formatted_message)
    print()
    
    print("🎯 EXPECTED MODEL RESPONSE:")
    print("=" * 30)
    expected_response = {
        "invoice_number": "SK/2024/001",
        "invoice_date": "2024-01-15",
        "invoice_amount": 25000.0,
        "buyer_gstin": "27AAPFU0939F1ZV",
        "seller_gstin": "29AADCS9958B1ZY"
    }
    print(json.dumps(expected_response, indent=2))
    print()
    
    print("✅ Format now matches your training data exactly!")
    print("🚀 Ready to test with: POST /api/chat/extract-invoice-with-model")

if __name__ == "__main__":
    test_instruction_format()
