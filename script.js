// ---------------------------------------------------------
// 1. DATA LOADING
// ---------------------------------------------------------

const mockData = [
    { app_name: "PUBG", language: "schinese" },
    { app_name: "PUBG", language: "schinese" },
    { app_name: "PUBG", language: "schinese" },
    { app_name: "PUBG", language: "english" },
    { app_name: "PUBG", language: "koreana" },
    
    { app_name: "Elden Ring", language: "english" },
    { app_name: "Elden Ring", language: "english" },
    { app_name: "Elden Ring", language: "schinese" },

    { app_name: "Terraria", language: "english" },
    { app_name: "Terraria", language: "brazilian" },
    { app_name: "Terraria", language: "russian" },

    { app_name: "Apex Legends", language: "english" },
    { app_name: "Apex Legends", language: "english" },
    { app_name: "Among Us", language: "english" },
    { app_name: "Among Us", language: "spanish" }
];

// ---------------------------------------------------------
// 2. CONFIGURATION & SETUP
// ---------------------------------------------------------
const width = 400;
const height = 400;
const radius = Math.min(width, height) / 2;

const colorScale = d3.scaleOrdinal(d3.schemeSet2); 

const svg = d3.select("#chart-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

const tooltip = d3.select("#tooltip");

const pie = d3.pie()
    .value(d => d.count)
    .sort(null);

const arc = d3.arc()
    .innerRadius(0) 
    .outerRadius(radius);

// ---------------------------------------------------------
// 3. MAIN LOGIC
// ---------------------------------------------------------

// If using real CSV: d3.csv("your_data.csv").then(data => init(data));
init(mockData);

function init(rawData) {
    
    // 1. Extract unique game names
    const allGames = Array.from(new Set(rawData.map(d => d.app_name))).sort();
    
    const selector = d3.select("#gameSelector");
    const searchInput = d3.select("#gameSearch");

    // 2. Function to populate the dropdown
    function populateDropdown(filterText = "") {
        // Clear existing options
        selector.html("");

        // Always add Global first
        selector.append("option").text("Global (All Games)").attr("value", "Global");

        // Filter games based on search text (case insensitive)
        const filteredGames = allGames.filter(game => 
            game.toLowerCase().startsWith(filterText.toLowerCase())
        );

        // Append filtered options
        filteredGames.forEach(game => {
            selector.append("option").text(game).attr("value", game);
        });
        
        // If the currently displayed chart (e.g. "Global") is still in the list, keep it selected.
        // Otherwise, default to the top option.
        // (Here we just let the browser default to the first option, "Global", on re-render)
    }

    // Initial population
    populateDropdown();

    // 3. Event Listener: Search Input
    searchInput.on("input", function() {
        const text = this.value;
        populateDropdown(text);
        
        // Reset chart to Global when search changes to avoid mismatch
        // (Or you could try to auto-select the first match)
        updateChart(rawData, "Global"); 
    });

    // 4. Event Listener: Dropdown Selection
    selector.on("change", function() {
        const selectedGame = d3.select(this).property("value");
        updateChart(rawData, selectedGame);
    });

    // 5. Initial Load
    updateChart(rawData, "Global");
}

function processData(rawData, selectedGame) {
    let filteredData = rawData;
    if (selectedGame !== "Global") {
        filteredData = rawData.filter(d => d.app_name === selectedGame);
    }

    const counts = d3.rollups(filteredData, v => v.length, d => d.language);
    const total = filteredData.length;
    
    return counts.map(([language, count]) => {
        return {
            language: language,
            count: count,
            percentage: (count / total) * 100
        };
    }).sort((a, b) => b.count - a.count);
}

function updateChart(rawData, selectedGame) {
    const data = processData(rawData, selectedGame);

    // --- PIE CHART ---
    const path = svg.selectAll("path")
        .data(pie(data), d => d.data.language);

    path.enter()
        .append("path")
        .attr("fill", d => colorScale(d.data.language))
        .attr("stroke", "#1b2838")
        .attr("stroke-width", "2px")
        .each(function(d) { this._current = d; })
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            tooltip.style("opacity", 1)
                   .html(`<strong>${d.data.language}</strong><br/>${d.data.percentage.toFixed(2)}%`);
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 15) + "px")
                   .style("top", (event.pageY - 15) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            tooltip.style("opacity", 0);
        })
        .transition().duration(750)
        .attrTween("d", function(d) {
            const i = d3.interpolate(d.startAngle+0.1, d.endAngle);
            return function(t) {
                d.endAngle = i(t);
                return arc(d);
            }
        });

    path.transition().duration(750)
        .attrTween("d", function(d) {
            const i = d3.interpolate(this._current, d);
            this._current = i(0);
            return function(t) { return arc(i(t)); };
        });

    path.exit()
        .transition().duration(750)
        .attrTween("d", function(d) {
            const i = d3.interpolate(d.startAngle, d.endAngle);
            return function(t) {
                d.startAngle = i(t);
                d.endAngle = i(t);
                return arc(d);
            };
        })
        .remove();

    // --- LEGEND ---
    updateLegend(data);
}

function updateLegend(data) {
    const legendContainer = d3.select("#legend-container");
    const items = legendContainer.selectAll(".legend-item")
        .data(data, d => d.language);

    const itemsEnter = items.enter()
        .append("div")
        .attr("class", "legend-item");

    itemsEnter.append("div")
        .attr("class", "legend-color")
        .style("background-color", d => colorScale(d.language));

    itemsEnter.append("span")
        .attr("class", "legend-text");

    itemsEnter.merge(items)
        .select(".legend-text")
        .text(d => `${d.language}: ${d.percentage.toFixed(2)}%`);
        
    itemsEnter.merge(items)
        .select(".legend-color")
        .style("background-color", d => colorScale(d.language));

    items.exit().remove();
}