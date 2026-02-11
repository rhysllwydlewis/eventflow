#!/usr/bin/env python3
"""
Add pre-rendered notification dropdown to HTML files
This script adds the notification dropdown HTML structure after the header element
"""

import os
import re
from pathlib import Path

# Notification dropdown HTML to inject
NOTIFICATION_DROPDOWN_HTML = '''
    <!-- Notification Dropdown (Pre-rendered, shown/hidden by JS) -->
    <div id="notification-dropdown" class="notification-dropdown" style="display: none;">
      <div class="notification-header">
        <h3>Notifications</h3>
        <button class="notification-mark-all" id="notification-mark-all-read">
          Mark all as read
        </button>
      </div>
      <div class="notification-list"></div>
      <div class="notification-footer">
        <a href="/notifications.html" class="notification-view-all">View all</a>
      </div>
    </div>
'''

def has_ef_header(content):
    """Check if file has ef-header class"""
    return 'ef-header' in content or 'class="ef-header"' in content

def has_notification_dropdown(content):
    """Check if file already has notification dropdown"""
    return 'id="notification-dropdown"' in content

def find_header_close_tag(content):
    """Find the closing </header> tag position"""
    # Find all </header> tags
    matches = list(re.finditer(r'</header>', content, re.IGNORECASE))
    if not matches:
        return None
    # Return the position after the first </header> tag
    return matches[0].end()

def inject_dropdown(content):
    """Inject the notification dropdown after the header"""
    pos = find_header_close_tag(content)
    if pos is None:
        return None
    
    # Insert the dropdown HTML after the header
    new_content = content[:pos] + '\n' + NOTIFICATION_DROPDOWN_HTML + content[pos:]
    return new_content

def process_file(file_path):
    """Process a single HTML file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if file has ef-header
        if not has_ef_header(content):
            return False, "No ef-header found"
        
        # Check if dropdown already exists
        if has_notification_dropdown(content):
            return False, "Dropdown already exists"
        
        # Inject the dropdown
        new_content = inject_dropdown(content)
        if new_content is None:
            return False, "Could not find header closing tag"
        
        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        return True, "Successfully added dropdown"
    
    except Exception as e:
        return False, f"Error: {str(e)}"

def main():
    # Find all HTML files
    public_dir = Path('public')
    html_files = list(public_dir.glob('**/*.html'))
    
    print(f"Found {len(html_files)} HTML files")
    print("=" * 60)
    
    success_count = 0
    skip_count = 0
    error_count = 0
    
    for html_file in sorted(html_files):
        success, message = process_file(html_file)
        
        if success:
            print(f"✓ {html_file}: {message}")
            success_count += 1
        elif "already exists" in message or "No ef-header" in message:
            # Skip silently
            skip_count += 1
        else:
            print(f"✗ {html_file}: {message}")
            error_count += 1
    
    print("=" * 60)
    print(f"Summary:")
    print(f"  ✓ Added dropdown: {success_count}")
    print(f"  - Skipped: {skip_count}")
    print(f"  ✗ Errors: {error_count}")

if __name__ == '__main__':
    main()
