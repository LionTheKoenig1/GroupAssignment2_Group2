-- Enable FTS capabilities
CREATE TABLE steam_reviews (
    id SERIAL PRIMARY KEY,
    app_id INT,
    app_name TEXT,
    review_id BIGINT,
    language TEXT,
    review TEXT,
    timestamp_created BIGINT,
    timestamp_updated BIGINT,
    recommended BOOLEAN,
    votes_helpful BIGINT,
    votes_funny BIGINT,
    weighted_vote_score DOUBLE PRECISION,
    comment_count INT,
    steam_purchase BOOLEAN,
    received_for_free BOOLEAN,
    written_during_early_access BOOLEAN,
    author_steamid NUMERIC,
    author_num_games_owned BIGINT,
    author_num_reviews BIGINT,
    author_playtime_forever DOUBLE PRECISION,
    author_playtime_last_two_weeks DOUBLE PRECISION,
    author_playtime_at_review DOUBLE PRECISION,
    author_last_played DOUBLE PRECISION,
    -- Search Vector for proximity searching
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', review)) STORED
);

-- Index for fast searching
CREATE INDEX idx_review_search ON steam_reviews USING GIN(search_vector);
CREATE INDEX idx_app_id ON steam_reviews (app_id);
CREATE INDEX idx_app_recommend ON steam_reviews (recommended);
CREATE INDEX idx_app_lang ON steam_reviews (language);

-- Import the CSV
-- We map every column in the file to the table columns
COPY steam_reviews(
    id, app_id, app_name, review_id, language, review, 
    timestamp_created, timestamp_updated, recommended, 
    votes_helpful, votes_funny, weighted_vote_score, 
    comment_count, steam_purchase, received_for_free, 
    written_during_early_access, author_steamid, 
    author_num_games_owned, author_num_reviews, 
    author_playtime_forever, author_playtime_last_two_weeks, 
    author_playtime_at_review, author_last_played
)
FROM '/tmp/data.csv'
DELIMITER ','
QUOTE '"'
CSV HEADER;

-- Read-only user for external access
CREATE USER readonly_user WITH PASSWORD 'Blush-Imposing-Glade6-Shopper-Subway';
GRANT CONNECT ON DATABASE postgres TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;