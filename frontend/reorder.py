import re

with open('/home/airlink_3.0/frontend/src/pages/Ledger.tsx', 'r') as f:
    content = f.read()

# Find the start and end of Filter Toolbar
filter_start_str = "      {/* Filter Toolbar */}"
filter_start = content.find(filter_start_str)

# Find the start of Summary KPI Cards
summary_start_str = "      {/* Summary KPI Cards */}"
summary_start = content.find(summary_start_str)

# Find the start of Itemized Sales Statement Table
itemized_start_str = "      {/* Itemized Sales Statement Table */}"
itemized_start = content.find(itemized_start_str)

# Extract sections
pre_filter = content[:filter_start]
filter_block = content[filter_start:summary_start]
summary_block = content[summary_start:itemized_start]
post_itemized = content[itemized_start:]

# Reorder: pre_filter + summary_block + filter_block + post_itemized
new_content = pre_filter + summary_block + filter_block + post_itemized

with open('/home/airlink_3.0/frontend/src/pages/Ledger.tsx', 'w') as f:
    f.write(new_content)

print("Reordering successful")
