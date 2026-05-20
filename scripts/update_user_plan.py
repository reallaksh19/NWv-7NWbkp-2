#!/usr/bin/env python3
"""
scripts/update_user_plan.py

A utility script to update the user's weekly plan data stored in public/data/user_plan.json.
This script is intended to be run in a server environment or local development setup where
file system write access is available.

Usage:
    python3 scripts/update_user_plan.py --action update --data '{"hiddenEvents": ["id1", "id2"], "customEvents": []}'
    python3 scripts/update_user_plan.py --action read

Arguments:
    --action: "read" or "update" (default: read)
    --file: Path to the target JSON file (default: public/data/user_plan.json)
    --data: JSON string containing the data to merge/write (required for update)

Note: In a static deployment (e.g., GitHub Pages), this script cannot be executed by the browser.
It serves as a backend utility for environments that support server-side execution.
"""

import os
import json
import argparse
import sys

DEFAULT_FILE_PATH = os.path.join("public", "data", "user_plan.json")

def load_plan(filepath):
    if not os.path.exists(filepath):
        return {}
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        print(f"Error: Failed to decode JSON from {filepath}", file=sys.stderr)
        return {}
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return {}

def save_plan(filepath, data):
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Successfully saved plan to {filepath}")
        return True
    except Exception as e:
        print(f"Error saving plan: {e}", file=sys.stderr)
        return False

def update_plan(current_data, new_data):
    # Merge logic:
    # - "hiddenEvents": Union of sets (to avoid duplicates)
    # - "customEvents": Overwrite or append? Let's assume overwrite for simplicity or merge if list.
    # For now, we'll do a shallow merge of keys, but special handling for lists could be added.

    updated = current_data.copy()

    for key, value in new_data.items():
        if key == "hiddenEvents" and isinstance(value, list):
            # Union of hidden events
            existing = set(updated.get("hiddenEvents", []))
            existing.update(value)
            updated["hiddenEvents"] = list(existing)
        else:
            # Direct overwrite for other keys
            updated[key] = value

    return updated

def main():
    parser = argparse.ArgumentParser(description="Manage user plan persistence.")
    parser.add_argument("--action", choices=["read", "update"], default="read", help="Action to perform")
    parser.add_argument("--file", default=DEFAULT_FILE_PATH, help="Path to the user plan JSON file")
    parser.add_argument("--data", help="JSON string data for update")

    args = parser.parse_args()

    current_plan = load_plan(args.file)

    if args.action == "read":
        print(json.dumps(current_plan, indent=2))

    elif args.action == "update":
        if not args.data:
            print("Error: --data argument is required for update action", file=sys.stderr)
            sys.exit(1)

        try:
            new_data = json.loads(args.data)
        except json.JSONDecodeError:
            print("Error: Invalid JSON string provided in --data", file=sys.stderr)
            sys.exit(1)

        updated_plan = update_plan(current_plan, new_data)
        if save_plan(args.file, updated_plan):
            print(json.dumps(updated_plan, indent=2))
        else:
            sys.exit(1)

if __name__ == "__main__":
    main()
