using CSV
using DataFrames
using Statistics
using Unicode
using JSON

vocab_size = 1000
vocab_size_output = 200
min_length = 5
radius = 3
csv_path = "../../../steam_reviews.csv"
output_path = "../heatmap"

myfilter(row) = !ismissing(row.language) && !ismissing(row.review) && length(row.review) ≥ min_length &&  lowercase(String(row.language)) == "english"

print("Loading CSV ")
time = @elapsed df_filtered = DataFrame(CSV.File(csv_path, select = ["app_id", "language", "review","recommended"])) |> df -> filter(myfilter, df)
print(" - Done  $time\n")

# --- Tokenize and clean words ---
function tokenize(text)
    # Lowercase → remove punctuation → split on whitespace
    cleaned = replace(lowercase(text), r"[^\p{L}\p{N}\s]" => " ")
    words = split(cleaned)
    return words
end

print("Tokenizing Reviews ")
time = @elapsed df_filtered.words = map(x -> tokenize.(String.(x)),df_filtered.review)
print(" - Done  $time\n")


function freqs(df)
    freq = Dict{String, Tuple{Int,Int,Int}}()
    for (i, row) in enumerate(eachrow(df))
        for w in row.words
            if length(w)>4
                entry = get(freq, w, (0,0,0))
                if row.recommended
                    freq[w] = (entry[1]+1, entry[2]+1, entry[3])
                else
                    freq[w] =  (entry[1]+1, entry[2], entry[3]+1)
                end
            end
        end
    end
    retval = DataFrame(
        word = collect(keys(freq)),
        count = [e[1] for e in values(freq)],
        pos = [e[2] for e in values(freq)],
        neg = [e[3] for e in values(freq)]
        )
    sort!(retval, :count, rev = true)
    return retval
end

for group in groupby(df_filtered, :app_id)
    app_id = group[1, :app_id]

    print("Calculating Frequencies ")
    global  time = @elapsed all = freqs(group)
    print(" - Done  $time\n")

    vocab = first(all, vocab_size)
    sort!(vocab, :word)

    function getid(w)
        res = searchsorted(vocab.word, w)
        if( length(res)==1)
            return res[1]
        else
            return nothing
        end
    end

    function cross(matrix, i)
        return Iterators.flatten([matrix[i,:], matrix[:,i]])
    end

    print("Splitting positive and negative ")
    global time = @elapsed begin
        positive_reviews = filter(row -> row.recommended, group)
        negative_reviews = filter(row -> !row.recommended, group)
    end
    print(" - Done  $time\n")

    adj_matrix = zeros(Float64, size(vocab)[1], size(vocab)[1])

    print("Calculating Matrix 1/2 ")
    global time = @elapsed for review in eachrow(positive_reviews)
        words = review.words  # Assuming 'words' is a column containing an array of words
        n = length(words)
        for i in 1:n
            word_i = words[i]
            id_i = getid(word_i)
            id_i === nothing && continue  # Skip if word not in vocabulary
            for j in max(1,i-3):min(n,i+3)  # Only iterate over pairs once per review
                word_j = words[j]
                id_j = getid(word_j)
                (id_j === nothing || id_j === id_i)  && continue
                adj_matrix[max(id_i, id_j), min(id_i, id_j)] += 1  # Update top triangle
            end
        end
    end
    print(" - Done  $time\n")

    # Process negative reviews (bottom triangle)
    print("Calculating Matrix 2/2 ")
    global time = @elapsed for review in eachrow(negative_reviews)
        words = review.words  # Assuming 'words' is a column containing an array of words
        n = length(words)
        for i in 1:n
            word_i = words[i]
            id_i = getid(word_i)
            id_i === nothing && continue
            for j in max(1,i-3):min(n,i+3)  # Only iterate over pairs once per review
                word_j = words[j]
                id_j = getid(word_j)
                (id_j === nothing || id_j === id_i)  && continue
                adj_matrix[min(id_i, id_j), max(id_i, id_j)] += 1  # Update top triangle
            end
        end
    end
    print(" - Done  $time\n")

    normalized = copy(adj_matrix)
    word_count_pos = sum(vocab.pos)
    word_count_neg = sum(vocab.neg)
    print("Normalizing Halves ")
    global time = @elapsed for i in 1:size(adj_matrix)[1]
        for j in i+1:size(adj_matrix)[2]
            normalized[i,j] = (normalized[i,j] * vocab.pos[i] * vocab.pos[j])/word_count_pos
            normalized[j,i] = (normalized[j,i] * vocab.neg[i] * vocab.neg[j])/word_count_neg
        end
    end
    print(" - Done  $time\n")



    function score(i)
        #return sum(sort(collect(Iterators.flatten([normalized[i, :],normalized[:, i]])); rev=true))
        i_mean = mean(cross(normalized, i))
        i_q = quantile(cross(normalized, i), 0.95)
        return (i_q/i_mean) * vocab.count[i]
    end

    vocab.score = [score(i) for i in 1:size(vocab)[1]]

    threshold = nothing
    begin
        word_scores = sort(vocab.score,rev=true)
        threshold = word_scores[vocab_size_output]
    end
    print("Threshold is: $threshold\n")

    function meets_threshold(i)
        return vocab.score[i] > threshold
    end

    filtered_matrix = copy(adj_matrix)
    filtered_vocab = copy(vocab)
    print("Filtering Matrix ")
    global time = @elapsed for i in size(vocab)[1]:-1:1
        if vocab[i,:score] < threshold
            # delete row, column and vocab
            deleteat!(filtered_vocab, i)
            filtered_matrix = filtered_matrix[1:end .!= i, 1:end .!= i]
        end
    end
    print(" - Done  $time\n")

    n = size(filtered_matrix, 1)
    factor = size(positive_reviews)[1]/size(negative_reviews)[1]
    delta = zeros(Float64, n, n)
    print("Calculating differences halves ")
    global time = @elapsed for i in 1:n
        for j in i+1:n  # Only iterate over the top triangle (excluding diagonal)
            val_ij = filtered_matrix[i, j] 
            val_ji = filtered_matrix[j, i]
            min_val = min(val_ij, val_ji)
            delta[i, j] =  val_ij - min_val  # Subtract min from [i,j]
            delta[j, i] =  val_ji - min_val  # Subtract min from [j,i]
        end
    end
    print(" - Done  $time\n")

    print("Writing Vocab to JSON ")
    global time = @elapsed open("$output_path/vocab/$app_id.json", "w") do f
        JSON.print(f, filtered_vocab.word, 4)
    end
    print(" - Done  $time\n")

    print("Writing Matrix to JSON ")
    global time = @elapsed open("$output_path/adj_matrix/$app_id.json", "w") do f
        JSON.print(f, filtered_matrix, 4)
    end
    print(" - Done  $time\n")

end