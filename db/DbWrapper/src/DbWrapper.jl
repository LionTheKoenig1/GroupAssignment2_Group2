module DbWrapper
using Oxygen
using LibPQ
using JSON3

# Generated with the help of Gemini

# Setup Database Connection
# Note: Use 'localhost' if running Julia on your host machine 
# or the container name if Julia is also in Docker.
const CONN_STR = "host=localhost user=readonly_user password=Blush-Imposing-Glade6-Shopper-Subway dbname=postgres"

@get "/search" function(req)
    params = queryparams(req)
    
    app_id = get(params, "app_id", "292030")
    w1     = get(params, "w1", "")
    w2     = get(params, "w2", "")
    rec    = lowercase(get(params, "rec", "true")) == "true"
    # 2. Connect and Query
    conn = LibPQ.Connection(CONN_STR)
    
    # We use $1, $2 etc. to safely pass variables (prevent SQL injection)
    # The search query uses: (w1 & w2) AND app_id AND recommended
    sql = """
        SELECT app_name, review, votes_helpful
        FROM steam_reviews
        WHERE search_vector @@ to_tsquery('english', \$1)
          AND app_id = \$2
          AND recommended = \$3
        ORDER BY ts_rank(search_vector, to_tsquery('english', \$1)) DESC
        LIMIT 10;
    """
    text_filter = "($w1 <6> $w2) | ($w2 <6> $w1)"
    @show text_filter
    result = execute(conn, sql, [text_filter, app_id, rec])
    # Correct way to get column names in LibPQ:
    cols = Symbol.(LibPQ.column_names(result))
    
    # Build the data array manually
    data = []
    for row in result
        # Create a dictionary for each row mapping col name to value
        push!(data, Dict(cols[i] => row[i] for i in 1:length(cols)))
    end
    
    close(conn)
    return data
end

# Start the server on port 8080
serve(port=8080, host="0.0.0.0", middleware=[Cors()])

end # module DbWrapper
