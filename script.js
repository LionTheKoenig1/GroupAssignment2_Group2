// ---------------------------------------------------------
// 1. DATA LOADING
// ---------------------------------------------------------

d3.csv("steam_reviews_small.csv").then(function(data) {
    console.log("Data loaded successfully:", data.length, "rows");
    
    // Convert types
    data.forEach(d => {
        d.recommended = (d.recommended === "True" || d.recommended === "true");
    });

    init(data);

}).catch(function(error) {
    console.error("Error loading CSV:", error);
});

// Display names for languages
const languageNameMap = {
    schinese: "Chinese (Simp.)", tchinese: "Chinese (Trad.)",
    english: "English", russian: "Russian", spanish: "Spanish",
    german: "German", french: "French", japanese: "Japanese",
    koreana: "Korean", brazilian: "Portuguese-BR", turkish: "Turkish",
    polish: "Polish", italian: "Italian", thai: "Thai"
};

// ---------------------------------------------------------
// 2. CONFIGURATION & SETUP
// ---------------------------------------------------------

// --- Pie Chart Config ---
const width = 400, height = 400, radius = Math.min(width, height) / 2;
const colorScale = d3.scaleOrdinal(d3.schemeSet2); 

const svgPie = d3.select("#chart-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

const pie = d3.pie().value(d => d.count).sort(null);
const arc = d3.arc().innerRadius(0).outerRadius(radius);

// --- Word Cloud Config ---
const wcWidth = 400, wcHeight = 400;
const svgCloud = d3.select("#wordcloud-container")
    .append("svg")
    .attr("width", wcWidth)
    .attr("height", wcHeight)
    .append("g")
    .attr("transform", `translate(${wcWidth / 2}, ${wcHeight / 2})`);

// Gradient: 0 (Negative) -> Yellow, 1 (Positive) -> Blue
const sentimentColorScale = d3.scaleLinear()
    .domain([0, 0.5, 1]) 
    .range(["#f1c40f", "#95a5a6", "#66c0f4"]); 

const tooltip = d3.select("#tooltip");

// ---------------------------------------------------------
// STOP WORDS SETUP (Using 'stopword' library + Manual Extras)
// ---------------------------------------------------------

// 1. Define custom gaming-specific stop words AND manual exclusions
const gamingStopWords = [
    // Standard Gaming terms
    "game", "games", "play", "played", "playing", "time", "get", "up", "out", 
    "best", "fun", "story", "gameplay", "really", "much", "even", "steam", 
    "review", "buy", "recommend", "10", "100", "fps", "yes", "no", "just", 
    "like", "good", "bad", "lot", "man", "make", "made", "can", "will", "your",
    
    // User Manual Exclusions (Contractions & noise)
    "not", "its", "it's", "don't", "can't", "won't", "didn't", "im", "i'm", 
    "ive", "i've", "that's", "thats", "theres", "there's", "cant", "dont"
];

// 2. Combine libraries from the 'sw' global object
let combinedStopWords = [];

if (typeof sw !== 'undefined') {
    combinedStopWords = [
        ...(sw.eng || []), 
        ...(sw.rus || []), 
        ...(sw.spa || []), 
        ...(sw.deu || []), 
        ...(sw.fra || []), 
        ...(sw.zho || []), 
        ...(sw.por || []), 
        ...(sw.jpn || []), 
        ...(sw.kor || []), 
        ...(sw.ita || []), 
        ...(sw.pol || []), 
        ...(sw.tur || []), 
        ...(sw.tha || []), 
        ...gamingStopWords
    ];
} else {
    console.error("Stopword library not loaded. Using fallback.");
    combinedStopWords = gamingStopWords;
}

// 3. Create the Set for fast O(1) lookups
const stopWords = new Set(combinedStopWords);

// ---------------------------------------------------------
// 3. MAIN LOGIC
// ---------------------------------------------------------

function init(rawData) {
    const allGames = Array.from(new Set(rawData.map(d => d.app_name))).sort();
    const selector = d3.select("#gameSelector");
    const searchInput = d3.select("#gameSearch");

    function populateDropdown(filterText = "") {
        selector.html("");
        selector.append("option").text("Global (All Games)").attr("value", "Global");
        const filteredGames = allGames.filter(g => g.toLowerCase().startsWith(filterText.toLowerCase()));
        filteredGames.forEach(g => selector.append("option").text(g).attr("value", g));
    }
    populateDropdown();

    searchInput.on("input", function() {
        populateDropdown(this.value);
        updateDashboard(rawData, "Global");
    });

    selector.on("change", function() {
        const selectedGame = d3.select(this).property("value");
        updateDashboard(rawData, selectedGame);
    });

    updateDashboard(rawData, "Global");
}

function updateDashboard(rawData, selectedGame) {
    let filteredData = rawData;
    if (selectedGame !== "Global") {
        filteredData = rawData.filter(d => d.app_name === selectedGame);
    }

    updateSentimentBar(filteredData);
    updatePieChart(filteredData);
    updateWordCloud(filteredData);
}

// ---------------------------------------------------------
// 4. SENTIMENT BAR LOGIC
// ---------------------------------------------------------
function updateSentimentBar(data) {
    const total = data.length;
    if (total === 0) return;

    const positiveCount = data.filter(d => d.recommended).length;
    const negativeCount = total - positiveCount;

    const posPct = (positiveCount / total) * 100;
    const negPct = (negativeCount / total) * 100;

    d3.select("#bar-negative").style("width", `${negPct}%`);
    d3.select("#bar-positive").style("width", `${posPct}%`);

    d3.select("#sentiment-percentage")
      .text(`${posPct.toFixed(1)}% Positive Review Ratio`);
}

// ---------------------------------------------------------
// 5. PIE CHART LOGIC
// ---------------------------------------------------------
function updatePieChart(data) {
    const counts = d3.rollups(data, v => v.length, d => d.language);
    const total = data.length;
    const processed = counts.map(([lang, count]) => ({
        language: lang, count, percentage: (count / total) * 100
    })).sort((a, b) => b.count - a.count);

    const path = svgPie.selectAll("path").data(pie(processed), d => d.data.language);

    path.enter().append("path")
        .attr("fill", d => colorScale(d.data.language))
        .attr("stroke", "#1b2838")
        .each(function(d) { this._current = d; })
        .merge(path)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            tooltip.style("opacity", 1)
                .html(`<strong>${languageNameMap[d.data.language] ?? d.data.language}</strong><br/>${d.data.percentage.toFixed(2)}%`);
        })
        .on("mousemove", event => tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px"))
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            tooltip.style("opacity", 0);
        })
        .transition().duration(750)
        .attrTween("d", function(d) {
            const i = d3.interpolate(this._current, d);
            this._current = i(0);
            return t => arc(i(t));
        });

    path.exit().remove();
    updateLegend(processed);
}

function updateLegend(data) {
    const container = d3.select("#legend-container");
    const items = container.selectAll(".legend-item").data(data, d => d.language);
    
    const enter = items.enter().append("div").attr("class", "legend-item");
    enter.append("div").attr("class", "legend-color");
    enter.append("span").attr("class", "legend-text");

    enter.merge(items).select(".legend-color").style("background-color", d => colorScale(d.language));
    enter.merge(items).select(".legend-text").text(d => `${languageNameMap[d.language] ?? d.language}: ${d.percentage.toFixed(2)}%`);
    items.exit().remove();
}

// ---------------------------------------------------------
// 6. WORD CLOUD LOGIC
// ---------------------------------------------------------
function updateWordCloud(data) {
    const wordMap = new Map();

    const dataToProcess = data; 
    const segmenter = new Intl.Segmenter([], { granularity: 'word' });

    dataToProcess.forEach(row => {
        if (!row.review || row.review.length < 2) return;

        const text = row.review.toLowerCase();
        const segments = segmenter.segment(text);
        const isPositive = row.recommended;

        for (const segment of segments) {
            const w = segment.segment;

            // Check if word exists in our expanded 'stopWords' Set
            if (segment.isWordLike && !stopWords.has(w)) {
                
                const isCJK = /[\u4e00-\u9fff]/.test(w);
                if (!isCJK && w.length < 3) continue; 

                if (!wordMap.has(w)) wordMap.set(w, { count: 0, posCount: 0 });
                const entry = wordMap.get(w);
                entry.count++;
                if (isPositive) entry.posCount++;
            }
        }
    });

    const wordsArray = Array.from(wordMap, ([text, d]) => ({
        text: text,
        size: d.count,
        frequency: d.count,
        sentiment: d.posCount / d.count 
    }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 70); 

    const sizeScale = d3.scaleSqrt()
        .domain(d3.extent(wordsArray, d => d.size))
        .range([15, 70]); 

    svgCloud.selectAll("*").remove();

    const layout = d3.layout.cloud()
        .size([wcWidth, wcHeight])
        .words(wordsArray)
        .padding(4)
        .rotate(() => 0) 
        .fontSize(d => sizeScale(d.size))
        .on("end", drawCloud);

    layout.start();

    function drawCloud(words) {
        const texts = svgCloud.selectAll("text")
            .data(words, d => d.text);

        texts.exit()
            .transition().duration(500)
            .style("opacity", 0)
            .remove();

        texts.enter().append("text")
            .style("font-family", "Impact, sans-serif")
            .style("fill", d => sentimentColorScale(d.sentiment))
            .attr("text-anchor", "middle")
            .attr("transform", d => `translate(${d.x}, ${d.y})scale(0.1)`)
            .text(d => d.text)
            .on("mouseover", function(event, d) {
                const sentPct = (d.sentiment * 100).toFixed(1);
                d3.select(this).style("opacity", 0.7);
                tooltip.style("opacity", 1)
                       .html(`<strong>${d.text}</strong><br/>
                              Freq: ${d.frequency}<br/>
                              <span style="color:${sentimentColorScale(d.sentiment)}">${sentPct}% Positive</span>`);
            })
            .on("mousemove", event => tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px"))
            .on("mouseout", function() {
                d3.select(this).style("opacity", 1);
                tooltip.style("opacity", 0);
            })
            .merge(texts)
            .transition().duration(1000)
            .style("fill", d => sentimentColorScale(d.sentiment))
            .attr("transform", d => `translate(${d.x}, ${d.y})rotate(${d.rotate})scale(1)`)
            .style("font-size", d => d.size + "px");
    }
}