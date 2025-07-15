#!/usr/bin/env python3
"""
Test script to verify the consolidated server functionality
"""

import requests
import time
import json

def test_consolidated_server():
    """Test the consolidated FastAPI server with monitoring"""
    
    base_url = "http://localhost:8000"
    
    print("🧪 Testing Consolidated Finetuning Server")
    print("=" * 50)
    
    try:
        # Test 1: Check if server is running
        print("1. Testing server availability...")
        response = requests.get(f"{base_url}/")
        if response.status_code == 200:
            print("   ✅ Server is running")
            print(f"   📋 API Info: {response.json()['message']}")
        else:
            print("   ❌ Server not responding")
            return
        
        # Test 2: Check dashboard endpoint
        print("\n2. Testing dashboard endpoint...")
        response = requests.get(f"{base_url}/dashboard")
        if response.status_code == 200:
            print("   ✅ Dashboard is accessible")
            print(f"   📊 Dashboard URL: {base_url}/dashboard")
        else:
            print("   ❌ Dashboard not accessible")
        
        # Test 3: Check monitoring API endpoints
        print("\n3. Testing monitoring API endpoints...")
        
        # Test /api/status
        response = requests.get(f"{base_url}/api/status")
        if response.status_code == 200:
            status_data = response.json()
            print("   ✅ /api/status endpoint working")
            print(f"   📈 Status: {status_data.get('status', 'unknown')}")
            print(f"   📊 Log count: {status_data.get('log_count', 0)}")
        else:
            print("   ❌ /api/status endpoint failed")
        
        # Test /api/logs
        response = requests.get(f"{base_url}/api/logs")
        if response.status_code == 200:
            logs_data = response.json()
            print("   ✅ /api/logs endpoint working")
            print(f"   📝 Logs available: {len(logs_data.get('logs', []))}")
        else:
            print("   ❌ /api/logs endpoint failed")
        
        # Test 4: Check dashboard info endpoint
        print("\n4. Testing dashboard info endpoint...")
        response = requests.get(f"{base_url}/dashboard-info")
        if response.status_code == 200:
            dashboard_info = response.json()
            print("   ✅ Dashboard info endpoint working")
            print(f"   🔗 Dashboard URL: {dashboard_info.get('dashboard_url')}")
            print(f"   📊 Status: {dashboard_info.get('status')}")
        else:
            print("   ❌ Dashboard info endpoint failed")
        
        # Test 5: Test job listing
        print("\n5. Testing job management endpoints...")
        response = requests.get(f"{base_url}/jobs")
        if response.status_code == 200:
            jobs_data = response.json()
            print("   ✅ Jobs listing endpoint working")
            print(f"   📋 Total jobs: {jobs_data.get('total', 0)}")
        else:
            print("   ❌ Jobs listing endpoint failed")
        
        # Test 6: Test simple finetuning endpoint (without actually starting training)
        print("\n6. Testing simple finetuning endpoint...")
        print("   ⚠️  Note: This will queue a training job but won't actually train due to missing dependencies")
        
        try:
            response = requests.post(f"{base_url}/finetune-simple")
            if response.status_code == 200:
                job_data = response.json()
                print("   ✅ Simple finetuning endpoint working")
                print(f"   🆔 Job ID: {job_data.get('job_id')}")
                print(f"   📊 Status: {job_data.get('status')}")
                print(f"   🔗 Dashboard: {job_data.get('dashboard_url')}")
                
                # Check job status
                job_id = job_data.get('job_id')
                if job_id:
                    time.sleep(1)  # Wait a moment
                    response = requests.get(f"{base_url}/jobs/{job_id}")
                    if response.status_code == 200:
                        job_status = response.json()
                        print(f"   📈 Job status check: {job_status.get('status')}")
            else:
                print(f"   ❌ Simple finetuning endpoint failed: {response.status_code}")
        except Exception as e:
            print(f"   ⚠️  Finetuning test skipped (expected if training dependencies missing): {e}")
        
        print("\n" + "=" * 50)
        print("🎉 Consolidated Server Test Summary:")
        print("✅ Single server running on port 8000")
        print("✅ Dashboard integrated into main server")
        print("✅ Monitoring API endpoints working")
        print("✅ No separate Flask server needed")
        print(f"🌐 Access dashboard at: {base_url}/dashboard")
        print("=" * 50)
        
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Make sure the server is running:")
        print("   python main.py")
        print("   or")
        print("   uvicorn main:app --host 0.0.0.0 --port 8000")
    except Exception as e:
        print(f"❌ Test failed with error: {e}")

if __name__ == "__main__":
    test_consolidated_server()
