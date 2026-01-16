// ---------------------------------------------------------
// 1. DATA LOADING
// ---------------------------------------------------------

d3.csv("steam_reviews_small.csv").then(function(data) {
    console.log("Data loaded successfully:", data.length, "rows");
    
    // Convert types
    data.forEach(d => {
        d.recommended = (d.recommended === "True" || d.recommended === "true");
        d.timestamp_created = new Date(d.timestamp_created * 1000); 
        d.timestamp_updated = new Date(d.timestamp_updated * 1000); 
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

// --- State Management ---
let currentGameData = []; 
let activeLanguage = null; 

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

// --- Histogram Config ---
const histMargin = {top: 20, right: 20, bottom: 30, left: 40},
    histWidth = 400 - histMargin.left - histMargin.right,
    histHeight = 400 - histMargin.top - histMargin.bottom;

const svgHist = d3.select("#histogram-container")
    .append("svg")
    .attr("width", 400)
    .attr("height", 400)
    .append("g")
    .attr("transform", `translate(${histMargin.left}, ${histMargin.top})`);

const sentimentColorScale = d3.scaleLinear()
    .domain([0, 0.5, 1]) 
    .range(["#f1c40f", "#95a5a6", "#66c0f4"]); 

const tooltip = d3.select("#tooltip");

// ---------------------------------------------------------
// STOP WORDS SETUP
// ---------------------------------------------------------
const gamingStopWords = [
    "game", "games", "play", "played", "playing", "time", "get", "up", "out", 
    "best", "fun", "story", "gameplay", "really", "much", "even", "steam", 
    "review", "buy", "recommend", "10", "100", "fps", "yes", "no", "just", 
    "like", "good", "bad", "lot", "man", "make", "made", "can", "will", "your",
    "not", "its", "it's", "don't", "can't", "won't", "didn't", "im", "i'm", 
    "ive", "i've", "that's", "thats", "theres", "there's", "cant", "dont"
];

let combinedStopWords = [];

if (typeof sw !== 'undefined') {
    combinedStopWords = [
        ...(sw.eng || []), ...(sw.rus || []), ...(sw.spa || []), ...(sw.deu || []), 
        ...(sw.fra || []), ...(sw.zho || []), ...(sw.por || []), ...(sw.jpn || []), 
        ...(sw.kor || []), ...(sw.ita || []), ...(sw.pol || []), ...(sw.tur || []), 
        ...(sw.tha || []), ...gamingStopWords
    ];
} else {
    combinedStopWords = gamingStopWords;
}
const stopWords = new Set(combinedStopWords);

// ---------------------------------------------------------
// 3. MAIN LOGIC
// ---------------------------------------------------------

function init(rawData) {
    const allGames = Array.from(new Set(rawData.map(d => d.app_name))).sort();
    const selector = d3.select("#gameSelector");
    const searchInput = d3.select("#gameSearch");
    const resetBtn = d3.select("#reset-language-btn");

    function populateDropdown(filterText = "") {
        const currentVal = selector.property("value");
        selector.html("");
        
        selector.append("option").text("Global (All Games)").attr("value", "Global");
        
        const filteredGames = allGames.filter(g => g.toLowerCase().includes(filterText.toLowerCase()));
        
        filteredGames.forEach(g => {
            selector.append("option").text(g).attr("value", g);
        });

        if (currentVal && (currentVal === "Global" || filteredGames.includes(currentVal))) {
            selector.property("value", currentVal);
        }
    }
    populateDropdown();

    // --- EVENT LISTENERS (FIXED) ---

    // 1. Search Input: Filter list & Expand dropdown
    searchInput.on("input", function() {
        const text = this.value;
        populateDropdown(text);

        if (text.length > 0) {
            // Use CSS class for expansion to avoid layout shift
            selector.classed("expanded", true)
                    .attr("size", 6); // Show 6 items
        } else {
            selector.classed("expanded", false)
                    .attr("size", null);
        }
    });

    searchInput.on("focus", function() {
        if(this.value.length > 0) {
            selector.classed("expanded", true)
                    .attr("size", 6);
        }
    });

    // 2. Game Selection
    selector.on("change", function() {
        const selectedGame = d3.select(this).property("value");
        
        if (selectedGame !== "Global") {
            searchInput.property("value", selectedGame);
        } else {
            searchInput.property("value", "");
        }

        // Collapse
        selector.classed("expanded", false)
                .attr("size", null);

        updateDashboard(rawData, selectedGame);
    });
    
    // Also handle 'click' on options for immediate close (UX improvement)
    selector.on("click", function() {
        // If it was expanded and user clicked, check if value changed or just close it
        if (selector.classed("expanded")) {
            selector.classed("expanded", false).attr("size", null);
        }
    });

    // 3. Click outside to collapse
    d3.select("body").on("click", function(event) {
        const target = event.target;
        if (target.id !== "gameSelector" && target.id !== "gameSearch") {
            selector.classed("expanded", false).attr("size", null);
        }
    });

    resetBtn.on("click", function() {
        handleLanguageSelection(null); 
    });

    updateDashboard(rawData, "Global");
}

function updateDashboard(rawData, selectedGame) {
    if (selectedGame !== "Global") {
        currentGameData = rawData.filter(d => d.app_name === selectedGame);
    } else {
        currentGameData = rawData;
    }

    activeLanguage = null;
    d3.select("#reset-language-btn").style("display", "none");

    updateSentimentBar(currentGameData);
    updatePieChart(currentGameData);
    updateWordCloud(currentGameData);
    updateHistogram(currentGameData);
}

function handleLanguageSelection(language) {
    activeLanguage = language;
    
    d3.select("#reset-language-btn").style("display", language ? "block" : "none");

    svgPie.selectAll("path")
        .classed("dimmed", d => language && d.data.language !== language);
    
    d3.select("#legend-container").selectAll(".legend-item")
        .classed("dimmed", d => language && d.language !== language);

    let filteredData = currentGameData;
    if (language) {
        filteredData = currentGameData.filter(d => d.language === language);
    }

    updateWordCloud(filteredData);
    updateHistogram(filteredData);
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

    d3.select("#sentiment-percentage").text(`${posPct.toFixed(1)}% Positive Review Ratio`);
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
        .style("cursor", "pointer")
        .each(function(d) { this._current = d; })
        .merge(path)
        .attr("class", "")
        .on("click", function(event, d) {
            if (activeLanguage === d.data.language) {
                handleLanguageSelection(null);
            } else {
                handleLanguageSelection(d.data.language);
            }
            event.stopPropagation();
        })
        .on("mouseover", function(event, d) {
            if (d3.select(this).classed("dimmed")) return;
            d3.select(this).attr("opacity", 0.8);
            tooltip.style("opacity", 1)
                .html(`<strong>${languageNameMap[d.data.language] ?? d.data.language}</strong><br/>${d.data.percentage.toFixed(2)}%<br/><span style="font-size:11px; color:#66c0f4">(Click to filter Word Cloud)</span>`);
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

    const merged = enter.merge(items);
    
    merged.select(".legend-color").style("background-color", d => colorScale(d.language));
    merged.select(".legend-text").text(d => `${languageNameMap[d.language] ?? d.language}: ${d.percentage.toFixed(2)}%`);
    
    merged.on("click", function(event, d) {
        if (activeLanguage === d.language) {
            handleLanguageSelection(null);
        } else {
            handleLanguageSelection(d.language);
        }
    });

    merged.classed("dimmed", false);
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
        const texts = svgCloud.selectAll("text").data(words, d => d.text);

        texts.exit().transition().duration(500).style("opacity", 0).remove();

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
                       .html(`<strong>${d.text}</strong><br/>Freq: ${d.frequency}<br/><span style="color:${sentimentColorScale(d.sentiment)}">${sentPct}% Positive</span>`);
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

// ---------------------------------------------------------
// 7. HISTOGRAM LOGIC
// ---------------------------------------------------------
function updateHistogram(data) {
    if (data.length === 0) {
        svgHist.selectAll("*").remove();
        return;
    }

    const counts = Array.from(d3.rollup(data, 
        v => d3.rollup(v, count => count.length, d => d.recommended), 
        d => {
            if (!d.timestamp_updated || isNaN(d.timestamp_updated)) return null;
            return d3.timeDay.floor(d.timestamp_updated);
        }
    ));

    const wideData = counts
        .filter(d => d[0] !== null)
        .map(([date, recommendedMap]) => {
            const trueCount = recommendedMap.get(true) || 0;
            const falseCount = recommendedMap.get(false) || 0;
            return {
                date: date,
                true: trueCount,
                false: falseCount,
                total: trueCount + falseCount
            };
        })
        .sort((a, b) => a.date - b.date);

    if (wideData.length === 0) return;

    const keys = ['true', 'false'];
    const stack = d3.stack().keys(keys);
    const stackedData = stack(wideData);

    const xScale = d3.scaleTime()
        .domain(d3.extent(wideData, d => d.date))
        .range([0, histWidth]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(stackedData[stackedData.length - 1], d => d[1])])
        .range([histHeight, 0]);

    const xAxis = d3.axisBottom(xScale).ticks(5);
    const yAxis = d3.axisLeft(yScale);

    svgHist.selectAll("*").remove();

    const barWidth = Math.max(1, (histWidth / wideData.length) - 1);

    const layer = svgHist.selectAll(".layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", "layer")
        .attr("fill", d => sentimentColorScale(d.key == "true" ? 1 : 0));

    layer.selectAll("rect")
        .data(d => d)
        .enter().append("rect")
        .attr("x", d => xScale(d.data.date))
        .attr("y", d => yScale(d[1]))
        .attr("height", d => yScale(d[0]) - yScale(d[1]))
        .attr("width", barWidth);

    svgHist.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0,${histHeight})`)
        .call(xAxis);

    svgHist.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);
}