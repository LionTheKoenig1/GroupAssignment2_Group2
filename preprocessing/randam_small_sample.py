import csv
import random
import sys

# FIX: Use the specific 32-bit integer maximum.
# This avoids the "Python int too large" error on Windows.
csv.field_size_limit(2147483647)

input_filename = "C:\\Users\\admin\\Downloads\\archive(1)\\steam_reviews.csv"
output_filename = 'steam_reviews_small.csv'

# Keep approx 1% of data
keep_probability = 0.01 

print(f"Scanning {input_filename}...")
print(f"Sampling ~{keep_probability*100}% of rows...")

try:
    with open(input_filename, 'r', encoding='utf-8', errors='ignore') as infile:
        with open(output_filename, 'w', encoding='utf-8', newline='') as outfile:
            reader = csv.reader(infile)
            writer = csv.writer(outfile)
            
            # 1. Write header
            try:
                header = next(reader)
                writer.writerow(header)
            except StopIteration:
                print("Error: The CSV file seems empty.")
                sys.exit()

            # 2. Iterate and sample
            count = 0
            kept = 0
            
            for row in reader:
                try:
                    count += 1
                    
                    # Randomly decide to keep
                    if random.random() < keep_probability:
                        # Optional: Skip if review text (usually index 4 or 5) is suspiciously huge
                        # but usually simply reading it successfully is enough.
                        writer.writerow(row)
                        kept += 1
                    
                    if count % 1000000 == 0:
                        print(f"Processed {count} rows... (Kept {kept})")

                except csv.Error:
                    # If a specific row is STILL malformed or too massive, 
                    # this block catches it and skips just that row.
                    continue

    print(f"Done! Processed {count} rows.")
    print(f"Created '{output_filename}' with {kept} rows.")

except FileNotFoundError:
    print(f"Error: Could not find '{input_filename}'.")