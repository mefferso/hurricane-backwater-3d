const COLORS = {
  rain: '#49c8f2',
  accumulated: '#8ee2c8',
  lake: '#56c7e8',
  river: '#7ca8ff',
  canal: '#b8a2ff',
  ditch: '#f0bc55',
  yard: '#f1b84d',
  house: '#ff756a',
  efficiency: '#75dfbd',
  comparison: '#d896ff'
};

const timeCursorPlugin = {
  id: 'timeCursor',
  afterDatasetsDraw(chart, _args, options) {
    const time = options?.currentTime;
    if (time == null || !chart.chartArea) return;
    const xScale = chart.scales.x;
    const x = xScale.getPixelForValue(time);
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();
  }
};

function baseOptions(yTitle, rightTitle = null) {
  const scales = {
    x: {
      type: 'linear',
      min: 0,
      max: 48,
      title: { display: true, text: 'Simulation hour', color: '#9eb7c4' },
      ticks: { color: '#9eb7c4', maxTicksLimit: 9 },
      grid: { color: 'rgba(170,211,226,0.08)' }
    },
    y: {
      position: 'left',
      beginAtZero: true,
      title: { display: true, text: yTitle, color: '#9eb7c4' },
      ticks: { color: '#9eb7c4' },
      grid: { color: 'rgba(170,211,226,0.08)' }
    }
  };

  if (rightTitle) {
    scales.y1 = {
      position: 'right',
      beginAtZero: true,
      title: { display: true, text: rightTitle, color: '#9eb7c4' },
      ticks: { color: '#9eb7c4' },
      grid: { drawOnChartArea: false }
    };
  }

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    normalized: true,
    scales,
    plugins: {
      legend: {
        labels: { color: '#dce9ef', boxWidth: 14, boxHeight: 3, usePointStyle: false, font: { size: 10 } }
      },
      tooltip: {
        backgroundColor: 'rgba(4,18,25,0.96)',
        titleColor: '#ffffff',
        bodyColor: '#dce9ef',
        borderColor: 'rgba(143,202,226,0.3)',
        borderWidth: 1,
        callbacks: {
          title(items) {
            return items.length ? `Hour ${Number(items[0].parsed.x).toFixed(1)}` : '';
          }
        }
      },
      timeCursor: { currentTime: 0 }
    }
  };
}

function dataset(label, color, yAxisID = 'y', extra = {}) {
  return {
    label,
    data: [],
    parsing: false,
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.22,
    yAxisID,
    ...extra
  };
}

function mapSeries(series, getter) {
  return series.map((point) => ({ x: point.time, y: getter(point) }));
}

export class HydroCharts {
  constructor() {
    const Chart = window.Chart;
    Chart.register(timeCursorPlugin);

    this.rainChart = new Chart(document.getElementById('rain-chart'), {
      type: 'line',
      data: {
        datasets: [
          dataset('Rain rate', COLORS.rain),
          dataset('Accumulated rain', COLORS.accumulated, 'y1')
        ]
      },
      options: baseOptions('Rain rate (in/hr)', 'Accumulated rain (in)')
    });

    this.levelChart = new Chart(document.getElementById('level-chart'), {
      type: 'line',
      data: {
        datasets: [
          dataset('Lake level', COLORS.lake),
          dataset('River level', COLORS.river),
          dataset('Canal level', COLORS.canal),
          dataset('Ditch water elevation', COLORS.ditch)
        ]
      },
      options: baseOptions('Water-surface elevation (ft)')
    });

    this.floodChart = new Chart(document.getElementById('flood-chart'), {
      type: 'line',
      data: {
        datasets: [
          dataset('Yard depth', COLORS.yard),
          dataset('House depth', COLORS.house),
          dataset('Drainage efficiency', COLORS.efficiency, 'y1')
        ]
      },
      options: baseOptions('Flood depth (in)', 'Efficiency (%)')
    });

    this.charts = [this.rainChart, this.levelChart, this.floodChart];
  }

  update(resultA, resultB = null, comparisonEnabled = false, unitSystem = 'imperial') {
    const metric = unitSystem === 'metric';
    const rainRateFactor = metric ? 25.4 : 1;
    const rainTotalFactor = metric ? 25.4 : 1;
    const levelFactor = metric ? 0.3048 : 1;
    const depthFactor = metric ? 30.48 : 12;

    this.rainChart.options.scales.y.title.text = metric ? 'Rain rate (mm/hr)' : 'Rain rate (in/hr)';
    this.rainChart.options.scales.y1.title.text = metric ? 'Accumulated rain (mm)' : 'Accumulated rain (in)';
    this.levelChart.options.scales.y.title.text = metric ? 'Water-surface elevation (m)' : 'Water-surface elevation (ft)';
    this.floodChart.options.scales.y.title.text = metric ? 'Flood depth (cm)' : 'Flood depth (in)';

    const a = resultA.series;
    this.rainChart.data.datasets = [
      { ...dataset('Rain rate — A', COLORS.rain), data: mapSeries(a, (p) => p.rainRate * rainRateFactor) },
      { ...dataset('Accumulated — A', COLORS.accumulated, 'y1'), data: mapSeries(a, (p) => p.cumulativeRain * rainTotalFactor) }
    ];
    this.levelChart.data.datasets = [
      { ...dataset('Lake — A', COLORS.lake), data: mapSeries(a, (p) => p.lakeLevel * levelFactor) },
      { ...dataset('River — A', COLORS.river), data: mapSeries(a, (p) => p.riverLevel * levelFactor) },
      { ...dataset('Canal — A', COLORS.canal), data: mapSeries(a, (p) => p.canalLevel * levelFactor) },
      { ...dataset('Ditch — A', COLORS.ditch), data: mapSeries(a, (p) => p.ditchWaterElevation * levelFactor) }
    ];
    this.floodChart.data.datasets = [
      { ...dataset('Yard — A', COLORS.yard), data: mapSeries(a, (p) => p.yardDepth * depthFactor) },
      { ...dataset('House — A', COLORS.house), data: mapSeries(a, (p) => p.houseDepth * depthFactor) },
      { ...dataset('Efficiency — A', COLORS.efficiency, 'y1'), data: mapSeries(a, (p) => p.drainageEfficiency) }
    ];

    if (comparisonEnabled && resultB) {
      const b = resultB.series;
      const comparisonStyle = { borderDash: [7, 5], borderWidth: 1.8 };
      this.rainChart.data.datasets.push(
        { ...dataset('Rain rate — B', COLORS.comparison, 'y', comparisonStyle), data: mapSeries(b, (p) => p.rainRate * rainRateFactor) },
        { ...dataset('Accumulated — B', COLORS.comparison, 'y1', { ...comparisonStyle, borderDash: [2, 5] }), data: mapSeries(b, (p) => p.cumulativeRain * rainTotalFactor) }
      );
      this.levelChart.data.datasets.push(
        { ...dataset('Lake — B', COLORS.comparison, 'y', comparisonStyle), data: mapSeries(b, (p) => p.lakeLevel * levelFactor) },
        { ...dataset('River — B', COLORS.comparison, 'y', { ...comparisonStyle, borderDash: [3, 4] }), data: mapSeries(b, (p) => p.riverLevel * levelFactor) },
        { ...dataset('Ditch — B', COLORS.comparison, 'y', { ...comparisonStyle, borderDash: [1, 4] }), data: mapSeries(b, (p) => p.ditchWaterElevation * levelFactor) }
      );
      this.floodChart.data.datasets.push(
        { ...dataset('Yard — B', COLORS.comparison, 'y', comparisonStyle), data: mapSeries(b, (p) => p.yardDepth * depthFactor) },
        { ...dataset('House — B', COLORS.comparison, 'y', { ...comparisonStyle, borderDash: [2, 5] }), data: mapSeries(b, (p) => p.houseDepth * depthFactor) },
        { ...dataset('Efficiency — B', COLORS.comparison, 'y1', { ...comparisonStyle, borderDash: [1, 4] }), data: mapSeries(b, (p) => p.drainageEfficiency) }
      );
    }

    this.charts.forEach((chart) => chart.update('none'));
  }

  setCursor(time) {
    this.charts.forEach((chart) => {
      chart.options.plugins.timeCursor.currentTime = time;
      chart.draw();
    });
  }
}
