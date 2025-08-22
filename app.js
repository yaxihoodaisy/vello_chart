let chartData = null;
let currentChart = null;
let selectedTest = null;
let selectedStyle = null;
let selectedMetric = 'time';
let selectedThreading = 'ST';
let currentProcessor = '';

window.addEventListener('DOMContentLoaded', function() {
    loadData(CHART_DATA_1);
    setupResizeObserver();
});

function setupResizeObserver() {
    const chartContainer = document.getElementById('chartContainer');
    if (!chartContainer) return;
    
    const resizeObserver = new ResizeObserver(entries => {
        if (currentChart) {
            currentChart.resize();
        }
    });
    
    resizeObserver.observe(chartContainer);
    
    // Also add window resize listener as fallback
    window.addEventListener('resize', () => {
        if (currentChart) {
            setTimeout(() => {
                currentChart.resize();
            }, 100);
        }
    });
}

function loadData(data) {
    try {
        if (typeof data !== 'undefined') {
            chartData = data;
            processData();
            updateProcessorDisplay();
            updateTimestamp();
            document.querySelector('.layout-wrapper').style.display = 'flex';
        } else {
            console.error('Data not found.');
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function updateProcessorDisplay() {
    if (chartData && chartData.cpu) {
        currentProcessor = chartData.cpu.brand || 'Unknown CPU';
        updateButtonStates('datasetButtons', currentProcessor);
    }
}

function updateTimestamp() {
    if (chartData && chartData.updated) {
        const timestampElement = document.getElementById('updateTimestamp');
        if (timestampElement) {
            timestampElement.textContent = `Updated on: ${chartData.updated}`;
        }
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
        button.classList.remove('active');
        if (button.textContent === activeValue) {
            button.classList.add('active');
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
    
    const currentTest = selectedTest;
    const currentStyle = selectedStyle;
    
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
        if (selectedThreading === 'ST') {
            if (!run.name.includes(' ST') && run.name.match(/\s+\d+T/)) return;
        } else {
            if (!run.name.match(/\s+(ST|\d+T)/)) return;
        }
        
        run.records.forEach(record => {
            testSet.add(record.test);
            styleSet.add(record.style);
        });
    });
    
    testOrder.forEach(test => {
        if (testSet.has(test)) tests.push(test);
    });
    Array.from(testSet).forEach(test => {
        if (!tests.includes(test)) tests.push(test);
    });
    
    styleOrder.forEach(style => {
        if (styleSet.has(style)) styles.push(style);
    });
    Array.from(styleSet).forEach(style => {
        if (!styles.includes(style)) styles.push(style);
    });
    
    const testContainer = document.getElementById('testButtons');
    testContainer.innerHTML = '';
    tests.forEach(test => {
        const button = createButton(test, () => selectTest(test));
        testContainer.appendChild(button);
    });
    
    const styleContainer = document.getElementById('styleButtons');
    styleContainer.innerHTML = '';
    styles.forEach(style => {
        const button = createButton(style, () => selectStyle(style));
        styleContainer.appendChild(button);
    });
    
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
    
    const filteredRuns = chartData.runs.filter(run => {
        if (selectedThreading === 'ST') {
            return run.name.includes(' ST') || !run.name.match(/\s+\d+T/);
        } else {
            return run.name.match(/\s+(ST|\d+T)/);
        }
    });
    
    const runData = [];
    const runColors = [];
    filteredRuns.forEach(run => {
        const record = run.records.find(r => 
            r.test === selectedTest && r.style === selectedStyle
        );
        
        if (record) {
            labels.push(run.name);
            let data = record.rcpms;
            
            if (selectedMetric === 'time') {
                data = data.map(rcpms => rcpms > 0 ? 1000 / rcpms : 0);
            }
            
            runData.push(data);
            runColors.push(getRendererColor(run.name));
        }
    });
    
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
                    formatter: function(value, context) {
                        const datasetLabel = context.dataset.label;
                        let valueStr;
                        
                        if (selectedMetric === 'time') {
                            if (value < 1) {
                                valueStr = value.toFixed(2) + ' ms';
                            } else if (value < 10) {
                                valueStr = value.toFixed(1) + ' ms';
                            } else {
                                valueStr = Math.round(value) + ' ms';
                            }
                        } else {
                            if (value < 1) {
                                valueStr = value.toFixed(2);
                            } else if (value < 10) {
                                valueStr = value.toFixed(1);
                            } else {
                                valueStr = Math.round(value).toString();
                            }
                        }
                        
                        return `${valueStr} [${datasetLabel}]`;
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
                    right: 70,
                    top: 10,
                    bottom: 10
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