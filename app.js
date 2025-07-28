let chartData = null;
let currentChart = null;
let selectedTest = null;
let selectedStyle = null;
let selectedMetric = 'time';
let selectedThreading = 'ST';
let currentProcessor = '';

// Load default data on page load
window.addEventListener('DOMContentLoaded', function() {
    loadDefaultData();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('defaultDatasetButton').addEventListener('click', loadDefaultData);
}

function loadDefaultData() {
    try {
        // Check if DEFAULT_CHART_DATA exists (from data.js)
        if (typeof DEFAULT_CHART_DATA !== 'undefined') {
            chartData = DEFAULT_CHART_DATA;
            processData();
            updateProcessorDisplay();
            document.querySelector('.layout-wrapper').style.display = 'flex';
        } else {
            console.error('Default data not found. Make sure data.js is loaded.');
            document.getElementById('defaultDatasetButton').textContent = 'No default data';
        }
    } catch (error) {
        console.error('Error loading default data:', error);
        document.getElementById('defaultDatasetButton').textContent = 'No default data';
    }
}

function updateProcessorDisplay() {
    if (chartData && chartData.cpu) {
        currentProcessor = chartData.cpu.brand || 'Unknown CPU';
        document.getElementById('defaultDatasetButton').textContent = currentProcessor;
        updateButtonStates('datasetButtons', currentProcessor);
    }
}

function processData() {
    if (!chartData || !chartData.runs) return;
    
    updateTestAndStyleButtons();
}

function createButton(text, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.onclick = onClick;
    return button;
}

function selectTest(test) {
    selectedTest = test;
    updateButtonStates('testButtons', test);
    updateChart();
}

function selectStyle(style) {
    selectedStyle = style;
    updateButtonStates('styleButtons', style);
    updateChart();
}


function updateButtonStates(containerId, activeValue) {
    const container = document.getElementById(containerId);
    Array.from(container.children).forEach(button => {
        if (button.textContent === activeValue) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

function selectMetric(metric) {
    selectedMetric = metric;
    updateButtonStates('metricButtons', metric === 'time' ? 'Time' : 'Render Calls');
    updateChart();
}

function selectThreading(threading) {
    selectedThreading = threading;
    updateButtonStates('threadingButtons', threading === 'ST' ? 'Single-Threaded' : 'Multi-Threaded');
    updateTestAndStyleButtons();
}


function updateTestAndStyleButtons() {
    const tests = [];
    const styles = [];
    const testSet = new Set();
    const styleSet = new Set();
    
    // Store current selections
    const currentTest = selectedTest;
    const currentStyle = selectedStyle;
    
    // Define the order based on Blend2D website
    const testOrder = [
        'FillRectA', 'FillRectU', 'FillRectRot', 'FillRoundU', 'FillRoundRot',
        'FillTriangle', 'FillPolyNZi10', 'FillPolyEOi10', 'FillPolyNZi20', 
        'FillPolyEOi20', 'FillPolyNZi40', 'FillPolyEOi40', 'FillButterfly',
        'FillFish', 'FillDragon', 'FillWorld', 'StrokeRectA', 'StrokeRectU',
        'StrokeRectRot', 'StrokeRoundU', 'StrokeRoundRot', 'StrokeTriangle',
        'StrokePoly10', 'StrokePoly20', 'StrokePoly40', 'StrokeButterfly',
        'StrokeFish', 'StrokeDragon', 'StrokeWorld'
    ];
    
    const styleOrder = ['Solid', 'Linear', 'Radial', 'Conic', 'Pattern'];
    
    chartData.runs.forEach((run, runIndex) => {
        // Use the same filter logic as the chart
        if (selectedThreading === 'ST') {
            if (!run.name.includes(' ST') && run.name.match(/\s+\d+T/)) return;
        } else {
            // Multi-threaded: only include runs with threading designations (ST, 2T, 4T, 8T, etc.)
            if (!run.name.match(/\s+(ST|\d+T)/)) return;
        }
        
        run.records.forEach(record => {
            testSet.add(record.test);
            styleSet.add(record.style);
        });
    });
    
    // Sort tests according to predefined order
    testOrder.forEach(test => {
        if (testSet.has(test)) tests.push(test);
    });
    // Add any remaining tests not in the order
    Array.from(testSet).forEach(test => {
        if (!tests.includes(test)) tests.push(test);
    });
    
    // Sort styles according to predefined order
    styleOrder.forEach(style => {
        if (styleSet.has(style)) styles.push(style);
    });
    // Add any remaining styles not in the order
    Array.from(styleSet).forEach(style => {
        if (!styles.includes(style)) styles.push(style);
    });
    
    // Generate test buttons
    const testContainer = document.getElementById('testButtons');
    testContainer.innerHTML = '';
    tests.forEach(test => {
        const button = createButton(test, () => selectTest(test));
        testContainer.appendChild(button);
    });
    
    // Generate style buttons
    const styleContainer = document.getElementById('styleButtons');
    styleContainer.innerHTML = '';
    styles.forEach(style => {
        const button = createButton(style, () => selectStyle(style));
        styleContainer.appendChild(button);
    });
    
    // Restore previous selections if they're still available, otherwise select first
    if (tests.includes(currentTest)) {
        selectTest(currentTest);
    } else if (tests.length > 0) {
        selectTest(tests[0]);
    }
    
    if (styles.includes(currentStyle)) {
        selectStyle(currentStyle);
    } else if (styles.length > 0) {
        selectStyle(styles[0]);
    }
}

function getRendererColor(runName) {
    // Extract renderer name from run name
    const renderer = runName.split(' ')[0].toLowerCase();
    
    const colorMap = {
        'blend2d': 'rgba(255, 99, 132, 0.8)',
        'agg': 'rgba(54, 162, 235, 0.8)',
        'cairo': 'rgba(255, 206, 86, 0.8)',
        'skia': 'rgba(75, 192, 192, 0.8)',
        'vello-cpu': 'rgba(153, 102, 255, 0.8)',
        'tiny-skia': 'rgba(255, 159, 64, 0.8)',
        'juce': 'rgba(199, 199, 199, 0.8)'
    };
    
    return colorMap[renderer] || 'rgba(128, 128, 128, 0.8)';
}

function updateChart() {
    if (!chartData || !selectedTest || !selectedStyle) return;
    
    const sizes = chartData.options.sizes;
    const labels = [];
    const datasets = [];
    
    // Filter runs based on threading selection
    const filteredRuns = chartData.runs.filter(run => {
        if (selectedThreading === 'ST') {
            // Single-threaded: show runs with "ST" or no threading designation
            return run.name.includes(' ST') || !run.name.match(/\s+\d+T/);
        } else {
            // Multi-threaded: show runs with threading designations (ST, 2T, 4T, 8T, etc.)
            return run.name.match(/\s+(ST|\d+T)/);
        }
    });
    
    // Get data for each filtered run
    const runData = [];
    const runColors = [];
    filteredRuns.forEach(run => {
        const record = run.records.find(r => 
            r.test === selectedTest && r.style === selectedStyle
        );
        
        if (record) {
            labels.push(run.name);
            let data = record.rcpms;
            
            // Convert based on selected metric
            if (selectedMetric === 'time') {
                // Convert to time (ms for 1000 render calls)
                data = data.map(rcpms => rcpms > 0 ? 1000 / rcpms : 0);
            }
            // For 'rcpms', keep the original data
            
            runData.push(data);
            runColors.push(getRendererColor(run.name));
        }
    });
    
    // Create datasets for each size
    sizes.forEach((size, sizeIndex) => {
        const data = runData.map(run => run[sizeIndex]);
        const backgroundColors = runColors;
        
        datasets.push({
            label: size,
            data: data,
            backgroundColor: backgroundColors,
            borderColor: backgroundColors.map(c => c.replace('0.8', '1')),
            borderWidth: 1
        });
    });
    
    const ctx = document.getElementById('performanceChart').getContext('2d');
    
    if (currentChart) {
        currentChart.destroy();
    }
    
    currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        plugins: [ChartDataLabels],
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: selectedMetric === 'time' 
                        ? 'Time of 1000 render calls'
                        : 'Render calls per 1ms',
                    font: {
                        size: 18
                    },
                    color: 'white'
                },
                legend: {
                    display: false
                },
                datalabels: {
                    display: true,
                    anchor: 'end',
                    align: 'right',
                    formatter: function(value) {
                        if (selectedMetric === 'time') {
                            if (value < 1) {
                                return value.toFixed(2) + ' ms';
                            } else if (value < 10) {
                                return value.toFixed(1) + ' ms';
                            } else {
                                return Math.round(value) + ' ms';
                            }
                        } else {
                            // For render calls per ms
                            if (value < 1) {
                                return value.toFixed(2);
                            } else if (value < 10) {
                                return value.toFixed(1);
                            } else {
                                return Math.round(value).toString();
                            }
                        }
                    },
                    color: 'white',
                    font: {
                        size: 11
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if (selectedMetric === 'time') {
                                return value + ' ms';
                            } else {
                                return value;
                            }
                        },
                        color: 'white',
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: {
                            size: 14
                        },
                        padding: 8,
                        color: 'white'
                    },
                    grid: {
                        display: false
                    }
                }
            },
            layout: {
                padding: {
                    left: 10,
                    right: 60
                }
            }
        }
    });
}

function getColor(index, alpha = 1) {
    const colors = [
        `rgba(255, 99, 132, ${alpha})`,
        `rgba(54, 162, 235, ${alpha})`,
        `rgba(255, 206, 86, ${alpha})`,
        `rgba(75, 192, 192, ${alpha})`,
        `rgba(153, 102, 255, ${alpha})`,
        `rgba(255, 159, 64, ${alpha})`
    ];
    return colors[index % colors.length];
}