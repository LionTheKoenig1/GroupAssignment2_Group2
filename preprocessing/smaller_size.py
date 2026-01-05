import csv

input_filename = "C:\\Users\\admin\\Downloads\\archive(1)\\steam_reviews.csv"
output_filename = 'steam_reviews_small.csv'
rows_to_keep = 50000

print(f"Reading from {input_filename}...")

try:
    with open(input_filename, 'r', encoding='utf-8', errors='ignore') as infile:
        with open(output_filename, 'w', encoding='utf-8', newline='') as outfile:
            reader = csv.reader(infile)
            writer = csv.writer(outfile)
            
            for i, row in enumerate(reader):
                if i >= rows_to_keep:
                    break
                writer.writerow(row)
                
    print(f"Success! Created '{output_filename}' with the first {rows_to_keep} rows.")
    print("Use this file in your d3.csv code.")

except FileNotFoundError:
    print(f"Error: Could not find '{input_filename}'. Make sure it is in this folder.")