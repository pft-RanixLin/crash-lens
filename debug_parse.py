#!/usr/bin/env python3
"""
Debug script to test Action block parsing
"""

import re

def debug_parse_action_blocks(filename):
    """Debug the Action block parsing"""
    
    with open(filename, 'r', encoding='utf-8') as file:
        lines = file.readlines()
    
    in_action_block = False
    current_action_data = {}
    action_start_line = 0
    action_timestamp = ""
    found_guids = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        # Extract timestamp and content
        timestamp_match = re.search(r'(\d+) \| (.*?) \| (.*)', line)
        if timestamp_match:
            line_num, timestamp, content = timestamp_match.groups()
            
            # Check if this is the start of an Action block
            if 'Action:{' in content:
                print(f"DEBUG: Found Action block start at line {line_num}: {content}")
                in_action_block = True
                current_action_data = {}
                action_start_line = int(line_num)
                action_timestamp = timestamp
                continue
        
        # If we're in an action block, parse the key-value pairs
        if in_action_block:
            print(f"DEBUG: In action block, processing line: '{line}'")
            
            if line == '}':
                # End of action block
                print(f"DEBUG: End of action block, found data: {current_action_data}")
                in_action_block = False
                
                # Extract GUID if present
                if 'text_style_guid' in current_action_data:
                    guid = current_action_data['text_style_guid']
                    print(f"DEBUG: Found GUID: {guid}")
                    found_guids.append({
                        'line': action_start_line,
                        'timestamp': action_timestamp,
                        'guid': guid,
                        'operation': current_action_data.get('operation', ''),
                        'feature_name': current_action_data.get('feature_name', ''),
                        'text_category': current_action_data.get('text_category', ''),
                        'layers_source': current_action_data.get('layers_source', '')
                    })
                print(f"DEBUG: Action block ended\n")
                
            elif ':' in line:
                # Parse key-value pair
                key, value = line.split(':', 1)
                current_action_data[key] = value
                print(f"DEBUG: Added key-value: {key} = {value}")
                continue
                
    print(f"\nDEBUG SUMMARY:")
    print(f"Found {len(found_guids)} GUIDs:")
    for guid_entry in found_guids:
        print(f"  Line {guid_entry['line']}: {guid_entry['guid']}")
    
    return found_guids

def main():
    log_filename = "com.cyberlink.youperfect_issue_9fb9cb710f3211a6ab5fcbc27ca795d3_crash_session_e20c9f3906d74a2e95e90abf14caaa63_DNE_1_v2.log"
    
    print("Debug parsing Action blocks...")
    debug_parse_action_blocks(log_filename)

if __name__ == "__main__":
    main() 