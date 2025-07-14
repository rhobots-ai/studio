#!/usr/bin/env python3
"""
Simple script to migrate existing JSON session files to the new folder structure
"""

import json
import os
import shutil

def create_session_directory(session_id: str) -> str:
    """Create a dedicated directory for a training session"""
    sessions_base_dir = "training_sessions"
    session_dir = os.path.join(sessions_base_dir, session_id)
    
    # Create main session directory
    if not os.path.exists(session_dir):
        os.makedirs(session_dir)
    
    # Create subdirectories
    subdirs = ['logs', 'config', 'data', 'checkpoints', 'outputs', 'artifacts']
    for subdir in subdirs:
        subdir_path = os.path.join(session_dir, subdir)
        if not os.path.exists(subdir_path):
            os.makedirs(subdir_path)
    
    return session_dir

def migrate_session_to_folder(session_id: str, session_data: dict):
    """Migrate old JSON session to new folder structure"""
    try:
        # Create new folder structure
        session_dir = create_session_directory(session_id)
        
        # Save main metadata
        metadata_file = os.path.join(session_dir, "metadata.json")
        with open(metadata_file, 'w') as f:
            json.dump(session_data, f, indent=2, default=str)
        
        # Save detailed configuration
        if 'config' in session_data:
            config_file = os.path.join(session_dir, "config", "training_config.json")
            with open(config_file, 'w') as f:
                json.dump(session_data['config'], f, indent=2, default=str)
        
        # Save dataset information
        if 'dataset_info' in session_data:
            dataset_file = os.path.join(session_dir, "config", "dataset_info.json")
            with open(dataset_file, 'w') as f:
                json.dump(session_data['dataset_info'], f, indent=2, default=str)
        
        # Remove old JSON file
        old_file = os.path.join("training_sessions", f"{session_id}.json")
        if os.path.exists(old_file):
            os.remove(old_file)
        
        print(f"✅ Migrated session {session_id} to folder structure")
        return True
        
    except Exception as e:
        print(f"❌ Error migrating session {session_id}: {e}")
        return False

def main():
    """Main migration function"""
    print("🔄 Starting session migration to folder structure...")
    
    sessions_dir = 'training_sessions'
    if not os.path.exists(sessions_dir):
        print(f"❌ Sessions directory {sessions_dir} does not exist")
        return
    
    # Get list of existing JSON files
    json_files = [f for f in os.listdir(sessions_dir) if f.endswith('.json')]
    
    if not json_files:
        print("ℹ️  No JSON session files found to migrate")
        return
    
    print(f"📁 Found {len(json_files)} session files to migrate")
    
    migrated_count = 0
    for json_file in json_files:
        session_id = json_file[:-5]  # Remove .json extension
        print(f"\n🔄 Migrating session: {session_id}")
        
        try:
            # Load the session data
            with open(os.path.join(sessions_dir, json_file), 'r') as f:
                session_data = json.load(f)
            
            # Migrate to folder structure
            if migrate_session_to_folder(session_id, session_data):
                migrated_count += 1
                
        except Exception as e:
            print(f"❌ Failed to load session {session_id}: {e}")
    
    print(f"\n✅ Migration complete! Successfully migrated {migrated_count}/{len(json_files)} sessions")

if __name__ == "__main__":
    main()
