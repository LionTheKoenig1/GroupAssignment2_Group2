using CSV
using DataFrames
using JSON

csv_path = "../../../steam_reviews.csv"

print("Loading CSV ")
time = @elapsed df = DataFrame(CSV.File(csv_path, select = ["app_id", "app_name", "language"]))
print(" - Done  $time\n")

struct Game 
    app_id::Int
    app_name::String
    languages::Any
end

function freqs(df)
    #freq = Vector{Tuple{String, Int}}()
    freq = Dict{String, Int}()
    for lang in eachrow(sort(combine(groupby(df, :language), nrow), :nrow, rev=true))
        #push!(freq, (lang.language, lang.nrow))
        freq[lang.language] = lang.nrow
    end
    return sort(collect(freq), by=(v)->v[2], rev=true)
end

all = Dict{String, Int}()
games = Dict{Int, Game}()

print("Counting Reviews")
global time = @elapsed for group in groupby(df, :app_id)
    app_id = group[1, :app_id]
    app_name = group[1, :app_name]
    freq = freqs(group)
    games[app_id] = Game(app_id, app_name, freq)
    for (lang, count) in freq
        old_count = get(all, lang, 0)
        all[lang] = old_count + count
    end
end
print(" - Done  $time\n")

print("Preparing Output")
output = Dict{String, Any}()
output["all"] = sort(collect(all), by=(v)->v[2], rev=true)
output["per_game"] = games
print(" - Done \n")

print("Writing Output")
global time = @elapsed open("../pie_chart.json", "w") do f
    JSON.print(f, output)
end
print(" - Done  $time\n")