/* tslint:disable */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// This tells TypeScript that these are global variables provided by the scripts.
declare var d3: any;
declare var Chart: any;

interface CPUProcess {
    id: number;
    name: string;
    arrivalTime: number;
    burstTime: number;
    priority: number;
    color: string;
    completionTime?: number;
    turnaroundTime?: number;
    waitingTime?: number;
    startTime?: number; // Added for Gantt chart
}

interface Metrics {
    avgWaitingTime: number;
    avgTurnaroundTime: number;
}

interface QuizQuestion {
    question: string;
    options: string[];
    answer: string;
}

class CPUSimulator {
    private processes: CPUProcess[] = [];
    private activeSection: string = 'intro';
    private currentView: 'home' | 'simulator' = 'home';
    private comparisonResults: { [key: string]: Metrics } = {};
    private comparisonChartInstance: any = null;

    private readonly quizQuestionPool: QuizQuestion[] = [
        { question: 'Which algorithm can suffer from the "convoy effect"?', options: ['SJF', 'FCFS', 'Priority'], answer: 'FCFS' },
        { question: 'Which non-preemptive algorithm is optimal for minimizing average waiting time?', options: ['SJF', 'FCFS', 'Round Robin'], answer: 'SJF' },
        { question: 'What is a potential problem with Priority Scheduling?', options: ['Convoy Effect', 'Starvation', 'High Throughput'], answer: 'Starvation' },
        { question: 'The time a process spends waiting in the ready queue is called:', options: ['Turnaround Time', 'Burst Time', 'Waiting Time'], answer: 'Waiting Time' },
        { question: 'FCFS scheduling is a...', options: ['Preemptive algorithm', 'Non-preemptive algorithm', 'Hybrid algorithm'], answer: 'Non-preemptive algorithm' },
        { question: 'If two processes in a priority queue have the same priority, which algorithm is typically used?', options: ['SJF', 'FCFS', 'Random'], answer: 'FCFS' },
    ];
    private currentQuizQuestions: QuizQuestion[] = [];

    constructor() {
        this.initializeProcesses();
        this.bindDOMEvents();
        this.render();
    }

    private initializeProcesses() {
        this.processes = [
            { id: 1, name: 'P1', arrivalTime: 0, burstTime: 6, priority: 3, color: '#3b82f6' },
            { id: 2, name: 'P2', arrivalTime: 7, burstTime: 4, priority: 1, color: '#22c55e' },
            { id: 3, name: 'P3', arrivalTime: 1, burstTime: 9, priority: 4, color: '#f97316' },
            { id: 4, name: 'P4', arrivalTime: 3, burstTime: 5, priority: 2, color: '#a855f7' },
        ];
    }

    private bindDOMEvents() {
        document.getElementById('enter-simulator').addEventListener('click', () => {
            this.currentView = 'simulator';
            this.render();
            this.initializeSimulatorView();
        });

        document.querySelector('#nav-links').addEventListener('click', (e) => {
            const target = e.target as HTMLAnchorElement;
            if (target.matches('a.nav-link')) {
                e.preventDefault();
                this.activeSection = target.getAttribute('href').substring(1);
                this.updateNavLinks();
                this.renderActiveSection();
            }
        });

        document.getElementById('run-fcfs').addEventListener('click', () => this.runSimulation('fcfs'));
        document.getElementById('run-sjf').addEventListener('click', () => this.runSimulation('sjf'));
        document.getElementById('run-priority').addEventListener('click', () => this.runSimulation('priority'));
        document.getElementById('quiz-form').addEventListener('submit', (e) => this.submitQuiz(e));
    }

    private initializeSimulatorView() {
        // Render initial tables and charts for the simulator
        this.renderProcessTable('#intro-process-table', false);
        this.renderProcessTable('#sjf-process-table', true, 'burstTime');
        this.renderProcessTable('#priority-process-table', true, 'priority');
        this.renderComparisonTable();
        
        // Pre-render the FCFS chart for the intro section
        const { scheduledProcesses } = this.calculateFCFS();
        this.renderGanttChart(scheduledProcesses, '#intro-gantt-chart');
    }

    private updateNavLinks() {
        document.querySelectorAll('a.nav-link').forEach(link => {
            link.classList.remove('text-blue-400', 'border-b-2', 'border-blue-400', 'font-semibold');
            link.classList.add('text-gray-400', 'font-medium');
            if (link.getAttribute('href') === `#${this.activeSection}`) {
                link.classList.add('text-blue-400', 'border-b-2', 'border-blue-400', 'font-semibold');
                link.classList.remove('text-gray-400', 'font-medium');
            }
        });
    }

    private runSimulation(algorithm: 'fcfs' | 'sjf' | 'priority') {
        if (algorithm === 'sjf' || algorithm === 'priority') {
            this.updateProcessesFromTable(algorithm);
        }

        let scheduledProcesses: CPUProcess[];
        let metrics: Metrics;

        switch (algorithm) {
            case 'fcfs': ({ scheduledProcesses, metrics } = this.calculateFCFS()); break;
            case 'sjf': ({ scheduledProcesses, metrics } = this.calculateSJF()); break;
            case 'priority': ({ scheduledProcesses, metrics } = this.calculatePriority()); break;
        }

        this.comparisonResults[algorithm] = metrics;
        const resultsEl = document.getElementById(`${algorithm}-results`);
        resultsEl.classList.remove('hidden');
        this.renderGanttChart(scheduledProcesses, `#${algorithm}-gantt-chart`);
        this.renderMetrics(metrics, `#${algorithm}-metrics`);
        this.renderComparisonTable();
        this.renderComparisonChart();
    }

    private calculateFCFS = () => this.executeSchedule([...this.processes].sort((a, b) => a.arrivalTime - b.arrivalTime));
    private calculateSJF = () => this.executeSchedule([...this.processes].sort((a, b) => a.burstTime - b.burstTime));
    private calculatePriority = () => this.executeSchedule([...this.processes].sort((a, b) => a.priority - b.priority));
    
    private executeSchedule(processQueue: CPUProcess[]): { scheduledProcesses: CPUProcess[], metrics: Metrics } {
        let currentTime = 0;
        let totalWaitingTime = 0;
        let totalTurnaroundTime = 0;
        const scheduledProcesses: CPUProcess[] = [];

        for (const process of processQueue) {
            if (currentTime < process.arrivalTime) currentTime = process.arrivalTime;
            const waitingTime = currentTime - process.arrivalTime;
            const completionTime = currentTime + process.burstTime;
            const turnaroundTime = completionTime - process.arrivalTime;
            totalWaitingTime += waitingTime;
            totalTurnaroundTime += turnaroundTime;
            scheduledProcesses.push({ ...process, startTime: currentTime, waitingTime, completionTime, turnaroundTime });
            currentTime = completionTime;
        }

        const metrics: Metrics = {
            avgWaitingTime: totalWaitingTime / processQueue.length,
            avgTurnaroundTime: totalTurnaroundTime / processQueue.length
        };

        return { scheduledProcesses, metrics };
    }

    private render() {
        const homeSection = document.getElementById('home-section');
        const simulatorSection = document.getElementById('simulator-section');
        if (this.currentView === 'home') {
            homeSection.classList.remove('hidden');
            simulatorSection.classList.add('hidden');
        } else {
            homeSection.classList.add('hidden');
            simulatorSection.classList.remove('hidden');
            this.renderActiveSection();
        }
    }
    
    private renderActiveSection() {
        document.querySelectorAll('.app-section').forEach(section => section.classList.add('hidden'));
        document.getElementById(this.activeSection).classList.remove('hidden');
        
        if (this.activeSection === 'quiz') {
            this.loadRandomQuizQuestions();
            this.renderQuizForm();
        }
    }

    private renderProcessTable(containerId: string, isEditable: boolean, editableField?: 'burstTime' | 'priority') {
        const container = document.querySelector(containerId);
        container.innerHTML = `
            <table class="w-full text-left border-collapse">
                <thead><tr class="bg-gray-700">
                    <th class="p-3 font-semibold">Process</th><th class="p-3 font-semibold">Arrival</th>
                    <th class="p-3 font-semibold">Burst</th><th class="p-3 font-semibold">Priority</th>
                </tr></thead>
                <tbody>${this.processes.map(p => `
                    <tr class="border-b border-gray-700">
                        <td class="p-3 flex items-center"><span class="w-4 h-4 rounded-full mr-3" style="background-color: ${p.color}"></span>${p.name}</td>
                        <td class="p-3">${p.arrivalTime}</td>
                        <td class="p-3">${isEditable && editableField === 'burstTime' ? `<input type="number" class="w-20 p-1 bg-gray-600 border border-gray-500 rounded" data-pid="${p.id}" data-field="burstTime" value="${p.burstTime}" min="1">` : p.burstTime}</td>
                        <td class="p-3">${isEditable && editableField === 'priority' ? `<input type="number" class="w-20 p-1 bg-gray-600 border border-gray-500 rounded" data-pid="${p.id}" data-field="priority" value="${p.priority}" min="1">` : p.priority}</td>
                    </tr>`).join('')}
                </tbody></table>`;
    }

    private updateProcessesFromTable(algorithm: 'sjf' | 'priority') {
        const field = algorithm === 'sjf' ? 'burstTime' : 'priority';
        document.querySelectorAll(`#${algorithm}-process-table input[data-field="${field}"]`).forEach(inputEl => {
            const input = inputEl as HTMLInputElement;
            const pid = parseInt(input.dataset.pid);
            const value = parseInt(input.value);
            const process = this.processes.find(p => p.id === pid);
            if (process && !isNaN(value) && value > 0) process[field] = value;
        });
    }

    private renderGanttChart(data: CPUProcess[], containerId: string) {
        const container = d3.select(containerId);
        container.selectAll('*').remove();
        const margin = { top: 20, right: 20, bottom: 30, left: 30 };
        const containerNode = container.node() as HTMLElement;
        if (!containerNode) return;

        const containerWidth = containerNode.getBoundingClientRect().width;
        if (containerWidth <= 0) return;

        const width = containerWidth - margin.left - margin.right;
        const height = 100 - margin.top - margin.bottom;

        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        const maxTime = d3.max(data, (d: CPUProcess) => d.completionTime);
        const xScale = d3.scaleLinear().domain([0, maxTime]).range([0, width]);

        svg.append('g')
           .attr('transform', `translate(0, ${height})`)
           .call(d3.axisBottom(xScale).ticks(Math.min(10, maxTime)))
           .selectAll("text").style("fill", "#9ca3af");

        svg.selectAll("line,path").style("stroke", "#4b5563");

        const rects = svg.selectAll('rect')
            .data(data)
            .enter()
            .append('rect')
            .attr('x', d => xScale(d.startTime))
            .attr('y', 0)
            .attr('width', 0) // Initial width is 0 for animation
            .attr('height', height)
            .attr('fill', d => d.color)
            .attr('stroke', '#1f2937')
            .attr('stroke-width', 2);

        rects.transition()
            .duration(800)
            .delay(d => d.startTime * 40) // Animate in sequence
            .attr('width', d => xScale(d.burstTime));

        const labels = svg.selectAll('text.process-label')
            .data(data)
            .enter()
            .append('text')
            .attr('class', 'process-label')
            .attr('x', d => xScale(d.startTime) + xScale(d.burstTime) / 2)
            .attr('y', height / 2 + 5)
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .style('font-weight', 'bold')
            .text(d => d.name)
            .attr('opacity', 0); // Initially hidden

        labels.transition()
            .duration(500)
            .delay(d => d.startTime * 40 + 400) // Fade in after the bar starts drawing
            .attr('opacity', 1);
    }

    private renderMetrics(metrics: Metrics, containerId: string) {
        document.querySelector(containerId).innerHTML = `
            <div class="bg-gray-700 p-4 rounded-lg text-center"><h4 class="font-semibold text-lg text-gray-300">Avg. Waiting Time</h4><p class="text-2xl font-bold text-blue-400">${metrics.avgWaitingTime.toFixed(2)}</p></div>
            <div class="bg-gray-700 p-4 rounded-lg text-center"><h4 class="font-semibold text-lg text-gray-300">Avg. Turnaround Time</h4><p class="text-2xl font-bold text-green-400">${metrics.avgTurnaroundTime.toFixed(2)}</p></div>`;
    }
    
    private renderComparisonTable() {
        const container = document.getElementById('comparison-table');
        const algorithms = ['fcfs', 'sjf', 'priority'];
        container.innerHTML = `
            <table class="w-full text-left border-collapse">
                <thead><tr class="bg-gray-700"><th class="p-3 font-semibold">Algorithm</th><th class="p-3 font-semibold">Avg. Waiting Time</th><th class="p-3 font-semibold">Avg. Turnaround Time</th></tr></thead>
                <tbody>${algorithms.map(alg => `<tr class="border-b border-gray-700"><td class="p-3 font-bold">${alg.toUpperCase()}</td><td class="p-3">${this.comparisonResults[alg] ? this.comparisonResults[alg].avgWaitingTime.toFixed(2) : 'N/A'}</td><td class="p-3">${this.comparisonResults[alg] ? this.comparisonResults[alg].avgTurnaroundTime.toFixed(2) : 'N/A'}</td></tr>`).join('')}</tbody>
            </table>`;
    }

    private renderComparisonChart() {
        const ctx = (document.getElementById('comparison-chart') as HTMLCanvasElement).getContext('2d');
        if (this.comparisonChartInstance) this.comparisonChartInstance.destroy();

        const labels = Object.keys(this.comparisonResults).map(k => k.toUpperCase());
        const waitingTimeData = Object.values(this.comparisonResults).map(r => r.avgWaitingTime);
        const turnaroundTimeData = Object.values(this.comparisonResults).map(r => r.avgTurnaroundTime);

        this.comparisonChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Avg. Waiting Time', data: waitingTimeData, backgroundColor: 'rgba(59, 130, 246, 0.7)', borderColor: 'rgba(59, 130, 246, 1)', borderWidth: 1 },
                    { label: 'Avg. Turnaround Time', data: turnaroundTimeData, backgroundColor: 'rgba(34, 197, 94, 0.7)', borderColor: 'rgba(34, 197, 94, 1)', borderWidth: 1 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { color: '#d1d5db' } }, x: { ticks: { color: '#d1d5db' } } },
                plugins: { legend: { labels: { color: '#d1d5db' } } }
            }
        });
    }
    
    private shuffleArray = (array: any[]) => array.map(value => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(({ value }) => value);

    private loadRandomQuizQuestions() {
        this.currentQuizQuestions = this.shuffleArray([...this.quizQuestionPool]).slice(0, 3); // Show 3 random questions
    }

    private renderQuizForm() {
        const form = document.getElementById('quiz-form');
        form.innerHTML = `
            ${this.currentQuizQuestions.map((q, index) => `
                <div class="mb-6">
                    <p class="font-semibold mb-2">${index + 1}. ${q.question}</p>
                    ${q.options.map(opt => `<label class="block ml-2"><input type="radio" name="q${index}" value="${opt}" class="mr-2">${opt}</label>`).join('')}
                </div>
            `).join('')}
            <button type="submit" class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded transition-transform transform hover:scale-105 duration-300">Submit Answers</button>
        `;
        document.getElementById('quiz-results').innerHTML = '';
    }

    private submitQuiz(e: Event) {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        let score = 0;
        let resultsHtml = '';

        this.currentQuizQuestions.forEach((q, index) => {
            const userAnswer = formData.get(`q${index}`);
            const isCorrect = userAnswer === q.answer;
            if (isCorrect) score++;
            resultsHtml += `<p>${index + 1}. ${q.question} <strong class="${isCorrect ? 'text-green-400' : 'text-red-400'}">${q.answer}</strong> ${isCorrect ? '✅' : '❌'}</p>`;
        });
        
        document.getElementById('quiz-results').innerHTML = `
            <p class="text-lg font-bold mb-2">You scored ${score} out of ${this.currentQuizQuestions.length}!</p>
            <div class="space-y-1">${resultsHtml}</div>`;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new CPUSimulator();
});