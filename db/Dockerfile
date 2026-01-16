# Use the official PostgreSQL image
FROM postgres:16

# Set environment variables for the default superuser
ENV POSTGRES_DB=postgres
ENV POSTGRES_USER=admin
ENV POSTGRES_PASSWORD=supersecretpassword

# Copy the initialization script to the auto-run directory
COPY init.sql /docker-entrypoint-initdb.d/

# Copy your CSV data file to a temporary location
COPY steam_reviews.csv /tmp/data.csv