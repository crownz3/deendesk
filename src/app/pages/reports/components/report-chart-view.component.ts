import { Component, Input, OnChanges, SimpleChanges, ElementRef, ViewChild } from '@angular/core';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-report-chart-view',
  standalone: false,
  template: `
    <div class="chart-wrapper">
      <canvas #chartCanvas></canvas>
    </div>
  `,
  styles: [`
    .chart-wrapper { width: 100%; height: 400px; display: flex; justify-content: center; align-items: center; }
    canvas { max-width: 100%; max-height: 100%; }
  `]
})
export class ReportChartViewComponent implements OnChanges {
  @Input() data: any[] = [];
  @Input() labelsKey: string = '';
  @Input() valuesKey: string = '';
  @Input() chartType: 'bar' | 'pie' | 'line' | 'doughnut' = 'bar';

  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef;
  private chartInstance: Chart | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['chartType'] || changes['labelsKey'] || changes['valuesKey']) {
      this.renderChart();
    }
  }

  private renderChart() {
    if (!this.data || this.data.length === 0 || !this.labelsKey || !this.valuesKey) {
      return;
    }

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const labels = this.data.map(d => d[this.labelsKey]);
    const values = this.data.map(d => Number(d[this.valuesKey]) || 0);

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    
    this.chartInstance = new Chart(ctx, {
      type: this.chartType,
      data: {
        labels: labels,
        datasets: [{
          label: 'Data',
          data: values,
          backgroundColor: [
            'rgba(63, 81, 181, 0.6)',
            'rgba(244, 67, 54, 0.6)',
            'rgba(76, 175, 80, 0.6)',
            'rgba(255, 193, 7, 0.6)',
            'rgba(156, 39, 176, 0.6)',
            'rgba(0, 188, 212, 0.6)',
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
}
