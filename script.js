// ==========================================================================
// グローバル変数と設定
// ==========================================================================
let usageInputChart = null;
let monthlyChart = null;
let breakdownChart = null;

// 料金体系データ（東京電力エリアベース）
const RATE_PLANS = {
  current: {
    name: '従来プラン',
    basicRate: {
      20: 572.00,
      30: 858.00,
      40: 1144.00,
      50: 1430.00,
      60: 1716.00
    },
    unitRates: [
      { min: 0, max: 120, rate: 19.88 },
      { min: 120, max: 300, rate: 26.46 },
      { min: 300, max: Infinity, rate: 30.57 }
    ],
    fuelAdjustment: 3.45,
    renewableLevy: 3.45
  },
  standard: {
    name: '標準プラン',
    basicRate: {
      20: 400.00,
      30: 600.00,
      40: 800.00,
      50: 1000.00,
      60: 1200.00
    },
    unitRates: [
      { min: 0, max: 120, rate: 19.20 },
      { min: 120, max: 300, rate: 25.50 },
      { min: 300, max: Infinity, rate: 29.80 }
    ],
    fuelAdjustment: 3.45,
    renewableLevy: 3.45
  },
  market: {
    name: '市場連動プラン',
    basicRate: {
      20: 0,
      30: 0,
      40: 0,
      50: 0,
      60: 0
    },
    baseRate: 18.50,
    peakRate: 32.00,
    offPeakRate: 15.00,
    fuelAdjustment: 0,
    renewableLevy: 3.45
  }
};

// 世帯人数別平均使用量（kWh/月）
const HOUSEHOLD_USAGE = {
  1: 240,
  2: 350,
  3: 450,
  4: 520
};

// 月別使用量の季節変動係数
const SEASONAL_FACTORS = [1.2, 1.1, 1.0, 0.9, 0.8, 0.9, 1.3, 1.4, 1.1, 0.9, 1.0, 1.2];

// ==========================================================================
// DOM要素の取得
// ==========================================================================
const modeButtons = document.querySelectorAll('.mode-btn');
const simpleForm = document.getElementById('simple-form');
const detailedForm = document.getElementById('detailed-form');
const householdButtons = document.querySelectorAll('[data-household]');
const ampereButtons = document.querySelectorAll('[data-ampere]');
const resultsSection = document.getElementById('results');
const loadingOverlay = document.getElementById('loading-overlay');

// ==========================================================================
// 初期化
// ==========================================================================
document.addEventListener('DOMContentLoaded', function() {
  initializeEventListeners();
  initializeUsageChart();
  setupInputValidation();
  
  // スムーズスクロールの設定
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
});

// ==========================================================================
// イベントリスナーの初期化
// ==========================================================================
function initializeEventListeners() {
  // モード切り替えボタン
  modeButtons.forEach(button => {
    button.addEventListener('click', function() {
      const mode = this.dataset.mode;
      switchMode(mode);
    });
  });

  // 世帯人数ボタン
  householdButtons.forEach(button => {
    button.addEventListener('click', function() {
      selectHousehold(this);
    });
  });

  // アンペア数ボタン
  ampereButtons.forEach(button => {
    button.addEventListener('click', function() {
      selectAmpere(this);
    });
  });

  // フォーム送信
  simpleForm.addEventListener('submit', handleSimpleFormSubmit);
  detailedForm.addEventListener('submit', handleDetailedFormSubmit);

  // 使用量入力の変更時にチャート更新
  for (let i = 1; i <= 12; i++) {
    const input = document.getElementById(`usage-${i}`);
    if (input) {
      input.addEventListener('input', updateUsageChart);
    }
  }

  // 入力フィールドのフォーカス効果
  document.querySelectorAll('.form-input, .form-select').forEach(input => {
    input.addEventListener('focus', function() {
      this.parentElement.classList.add('focused');
    });
    
    input.addEventListener('blur', function() {
      this.parentElement.classList.remove('focused');
    });
  });

  // 郵便番号の自動フォーマット
  document.querySelectorAll('input[type="text"][pattern*="\\d{3}-\\d{4}"]').forEach(input => {
    input.addEventListener('input', formatPostalCode);
  });
}

// ==========================================================================
// UI制御関数
// ==========================================================================
function switchMode(mode) {
  // ボタンの状態更新
  modeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  // フォームの表示切り替え
  simpleForm.classList.toggle('active', mode === 'simple');
  detailedForm.classList.toggle('active', mode === 'detailed');

  // アニメーション効果
  const activeForm = mode === 'simple' ? simpleForm : detailedForm;
  activeForm.style.animation = 'none';
  setTimeout(() => {
    activeForm.style.animation = 'fadeInUp 0.5s ease-out';
  }, 10);
}

function selectHousehold(button) {
  // 他のボタンの選択状態を解除
  householdButtons.forEach(btn => btn.classList.remove('active'));
  // 選択されたボタンをアクティブに
  button.classList.add('active');
  
  // アニメーション効果
  button.style.transform = 'scale(0.95)';
  setTimeout(() => {
    button.style.transform = '';
  }, 150);
}

function selectAmpere(button) {
  // 他のボタンの選択状態を解除
  ampereButtons.forEach(btn => btn.classList.remove('active'));
  // 選択されたボタンをアクティブに
  button.classList.add('active');
  
  // アニメーション効果
  button.style.transform = 'scale(0.95)';
  setTimeout(() => {
    button.style.transform = '';
  }, 150);
}

function formatPostalCode(e) {
  let value = e.target.value.replace(/[^\d]/g, '');
  if (value.length >= 3) {
    value = value.slice(0, 3) + '-' + value.slice(3, 7);
  }
  e.target.value = value;
}

function showLoading() {
  loadingOverlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function hideLoading() {
  loadingOverlay.style.display = 'none';
  document.body.style.overflow = '';
}

// ==========================================================================
// フォーム送信処理
// ==========================================================================
async function handleSimpleFormSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const postalCode = document.getElementById('postal-code').value;
  const currentCompany = document.getElementById('current-company').value;
  const currentBill = parseInt(document.getElementById('current-bill').value);
  const householdButton = document.querySelector('.option-btn[data-household].active');
  
  // バリデーション
  if (!postalCode || !currentCompany || !currentBill || !householdButton) {
    showError('すべての項目を入力してください。');
    return;
  }
  
  const householdSize = parseInt(householdButton.dataset.household);
  
  showLoading();
  
  try {
    // シミュレーション実行
    await new Promise(resolve => setTimeout(resolve, 1500)); // ローディング演出
    
    const simulationData = calculateSimpleSimulation({
      postalCode,
      currentCompany,
      currentBill,
      householdSize
    });
    
    displayResults(simulationData);
    scrollToResults();
    
  } catch (error) {
    console.error('シミュレーションエラー:', error);
    showError('シミュレーションに失敗しました。もう一度お試しください。');
  } finally {
    hideLoading();
  }
}

async function handleDetailedFormSubmit(e) {
  e.preventDefault();
  
  const postalCode = document.getElementById('postal-code-detailed').value;
  const currentCompany = document.getElementById('current-company-detailed').value;
  const ampereButton = document.querySelector('.option-btn[data-ampere].active');
  
  // バリデーション
  if (!postalCode || !currentCompany || !ampereButton) {
    showError('すべての項目を入力してください。');
    return;
  }
  
  const ampere = parseInt(ampereButton.dataset.ampere);
  const monthlyUsage = [];
  
  for (let i = 1; i <= 12; i++) {
    const usage = parseInt(document.getElementById(`usage-${i}`).value) || 0;
    monthlyUsage.push(usage);
  }
  
  if (monthlyUsage.every(usage => usage === 0)) {
    showError('月別使用量を入力してください。');
    return;
  }
  
  showLoading();
  
  try {
    // シミュレーション実行
    await new Promise(resolve => setTimeout(resolve, 2000)); // ローディング演出
    
    const simulationData = calculateDetailedSimulation({
      postalCode,
      currentCompany,
      ampere,
      monthlyUsage
    });
    
    displayResults(simulationData);
    scrollToResults();
    
  } catch (error) {
    console.error('シミュレーションエラー:', error);
    showError('シミュレーションに失敗しました。もう一度お試しください。');
  } finally {
    hideLoading();
  }
}

// ==========================================================================
// 料金計算関数
// ==========================================================================
function calculateSimpleSimulation(data) {
  const { householdSize, currentBill } = data;
  
  // 推定使用量を計算
  const averageUsage = HOUSEHOLD_USAGE[householdSize];
  const monthlyUsage = SEASONAL_FACTORS.map(factor => Math.round(averageUsage * factor));
  
  // 推定アンペア数（使用量から逆算）
  const estimatedAmpere = estimateAmpereFromUsage(averageUsage);
  
  return calculateDetailedSimulation({
    ...data,
    ampere: estimatedAmpere,
    monthlyUsage,
    isSimpleMode: true,
    originalBill: currentBill
  });
}

function calculateDetailedSimulation(data) {
  const { ampere, monthlyUsage, isSimpleMode = false, originalBill = null } = data;
  
  // 各プランの年間料金を計算
  const currentPlanCosts = calculateYearlyPlanCost('current', ampere, monthlyUsage);
  const standardPlanCosts = calculateYearlyPlanCost('standard', ampere, monthlyUsage);
  const marketPlanCosts = calculateYearlyPlanCost('market', ampere, monthlyUsage);
  
  // 簡易モードの場合は実際の料金を使用
  if (isSimpleMode && originalBill) {
    currentPlanCosts.total = originalBill * 12;
    currentPlanCosts.monthly = originalBill;
  }
  
  // 節約額計算
  const standardSavings = currentPlanCosts.total - standardPlanCosts.total;
  const marketSavings = currentPlanCosts.total - marketPlanCosts.total;
  
  // おすすめプラン選択
  const recommendedPlan = standardSavings > marketSavings ? 'standard' : 'market';
  const maxSavings = Math.max(standardSavings, marketSavings);
  
  return {
    current: currentPlanCosts,
    standard: standardPlanCosts,
    market: marketPlanCosts,
    savings: {
      annual: Math.round(maxSavings),
      monthly: Math.round(maxSavings / 12),
      standard: Math.round(standardSavings),
      market: Math.round(marketSavings)
    },
    recommended: recommendedPlan,
    monthlyUsage,
    ampere
  };
}

function calculateYearlyPlanCost(planType, ampere, monthlyUsage) {
  const plan = RATE_PLANS[planType];
  let totalCost = 0;
  const monthlyCosts = [];
  
  for (let month = 0; month < 12; month++) {
    const usage = monthlyUsage[month];
    let monthlyCost = 0;
    
    if (planType === 'market') {
      // 市場連動プランの計算
      monthlyCost = plan.basicRate[ampere] + 
                   (usage * 0.3 * plan.peakRate) + // 30%がピーク時間
                   (usage * 0.4 * plan.baseRate) + // 40%が通常時間
                   (usage * 0.3 * plan.offPeakRate) + // 30%がオフピーク時間
                   (usage * plan.renewableLevy);
    } else {
      // 従来・標準プランの計算
      monthlyCost = plan.basicRate[ampere];
      
      // 従量料金計算
      let remainingUsage = usage;
      for (const tier of plan.unitRates) {
        const tierUsage = Math.min(remainingUsage, tier.max - tier.min);
        monthlyCost += tierUsage * tier.rate;
        remainingUsage -= tierUsage;
        if (remainingUsage <= 0) break;
      }
      
      // 燃料費調整額と再エネ賦課金
      monthlyCost += usage * (plan.fuelAdjustment + plan.renewableLevy);
    }
    
    monthlyCosts.push(Math.round(monthlyCost));
    totalCost += monthlyCost;
  }
  
  return {
    total: Math.round(totalCost),
    monthly: Math.round(totalCost / 12),
    monthlyCosts
  };
}

function estimateAmpereFromUsage(averageUsage) {
  if (averageUsage < 250) return 30;
  if (averageUsage < 350) return 40;
  if (averageUsage < 450) return 50;
  return 60;
}

// ==========================================================================
// 結果表示関数
// ==========================================================================
function displayResults(data) {
  // メインビジュアルの更新
  updateMainResult(data);
  
  // プラン比較の更新
  updatePlanComparison(data);
  
  // チャートの描画
  drawCharts(data);
  
  // 詳細情報の更新
  updatePlanDetails(data);
  
  // 結果セクションを表示
  resultsSection.style.display = 'block';
}

function updateMainResult(data) {
  const annualSavingsElement = document.getElementById('annual-savings');
  const monthlySavingsElement = document.getElementById('monthly-savings');
  
  // カウントアップアニメーション
  animateCountUp(annualSavingsElement, 0, data.savings.annual, 2000);
  animateCountUp(monthlySavingsElement, 0, data.savings.monthly, 1500, '¥');
}

function updatePlanComparison(data) {
  // 現在のプラン
  document.getElementById('current-plan-price').textContent = `¥${data.current.monthly.toLocaleString()}`;
  
  // 標準プラン
  document.getElementById('standard-plan-price').textContent = `¥${data.standard.monthly.toLocaleString()}`;
  
  // 市場連動プラン
  document.getElementById('market-plan-price').textContent = `¥${data.market.monthly.toLocaleString()}`;
  
  // おすすめプランのハイライト
  const standardCard = document.querySelector('.plan-card.recommended');
  const marketCard = document.querySelector('.plan-card.market');
  
  if (data.recommended === 'standard') {
    standardCard.classList.add('recommended');
    marketCard.classList.remove('recommended');
  } else {
    standardCard.classList.remove('recommended');
    marketCard.classList.add('recommended');
  }
}

function updatePlanDetails(data) {
  // プランの詳細情報を更新（必要に応じて実装）
}

function animateCountUp(element, start, end, duration, prefix = '') {
  const startTime = performance.now();
  const difference = end - start;
  
  function updateNumber(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // イージング関数（ease-out）
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(start + (difference * easedProgress));
    
    element.textContent = prefix + currentValue.toLocaleString();
    
    if (progress < 1) {
      requestAnimationFrame(updateNumber);
    }
  }
  
  requestAnimationFrame(updateNumber);
}

function scrollToResults() {
  setTimeout(() => {
    resultsSection.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }, 300);
}

// ==========================================================================
// チャート関数
// ==========================================================================
function initializeUsageChart() {
  const ctx = document.getElementById('usage-input-chart');
  if (!ctx) return;
  
  usageInputChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      datasets: [{
        label: '使用量 (kWh)',
        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(0, 166, 81, 0.6)',
        borderColor: 'rgba(0, 166, 81, 1)',
        borderWidth: 2,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function updateUsageChart() {
  if (!usageInputChart) return;
  
  const data = [];
  for (let i = 1; i <= 12; i++) {
    const input = document.getElementById(`usage-${i}`);
    data.push(parseInt(input.value) || 0);
  }
  
  usageInputChart.data.datasets[0].data = data;
  usageInputChart.update('none'); // アニメーションなしで更新
}

function drawCharts(data) {
  drawMonthlyChart(data);
  drawBreakdownChart(data);
}

function drawMonthlyChart(data) {
  const ctx = document.getElementById('monthly-chart');
  if (!ctx) return;
  
  if (monthlyChart) {
    monthlyChart.destroy();
  }
  
  monthlyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      datasets: [
        {
          label: '現在のプラン',
          data: data.current.monthlyCosts,
          borderColor: 'rgba(138, 155, 168, 1)',
          backgroundColor: 'rgba(138, 155, 168, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          pointBackgroundColor: 'rgba(138, 155, 168, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 6
        },
        {
          label: data.recommended === 'standard' ? '標準プラン（おすすめ）' : '標準プラン',
          data: data.standard.monthlyCosts,
          borderColor: 'rgba(0, 166, 81, 1)',
          backgroundColor: 'rgba(0, 166, 81, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          pointBackgroundColor: 'rgba(0, 166, 81, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: data.recommended === 'standard' ? 8 : 6
        },
        {
          label: data.recommended === 'market' ? '市場連動プラン（おすすめ）' : '市場連動プラン',
          data: data.market.monthlyCosts,
          borderColor: 'rgba(30, 136, 229, 1)',
          backgroundColor: 'rgba(30, 136, 229, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          pointBackgroundColor: 'rgba(30, 136, 229, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: data.recommended === 'market' ? 8 : 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 20
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#2C3E50',
          bodyColor: '#5A6C7D',
          borderColor: 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ¥' + context.parsed.y.toLocaleString();
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          },
          ticks: {
            callback: function(value) {
              return '¥' + value.toLocaleString();
            }
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeOutQuart'
      }
    }
  });
}

function drawBreakdownChart(data) {
  const ctx = document.getElementById('breakdown-chart');
  if (!ctx) return;
  
  if (breakdownChart) {
    breakdownChart.destroy();
  }
  
  const recommendedPlan = data.recommended === 'standard' ? data.standard : data.market;
  const savings = data.savings.annual;
  const newTotal = recommendedPlan.total;
  
  breakdownChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['節約額', '新プラン料金'],
      datasets: [{
        data: [savings, newTotal],
        backgroundColor: [
          'rgba(255, 107, 53, 0.8)',
          'rgba(0, 166, 81, 0.8)'
        ],
        borderColor: [
          'rgba(255, 107, 53, 1)',
          'rgba(0, 166, 81, 1)'
        ],
        borderWidth: 2,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#2C3E50',
          bodyColor: '#5A6C7D',
          borderColor: 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return context.label + ': ¥' + value.toLocaleString() + ' (' + percentage + '%)';
            }
          }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeOutQuart'
      }
    }
  });
}

// ==========================================================================
// エラーハンドリング関数
// ==========================================================================
function showError(message) {
  // 簡易的なエラー表示（実際のプロダクションではより洗練されたモーダルやトーストを使用）
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff4757;
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    font-weight: 500;
    animation: slideInRight 0.3s ease-out;
  `;
  errorDiv.textContent = message;
  
  document.body.appendChild(errorDiv);
  
  // 5秒後に自動削除
  setTimeout(() => {
    errorDiv.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 300);
  }, 5000);
}

// ==========================================================================
// 入力バリデーション関数
// ==========================================================================
function setupInputValidation() {
  // 郵便番号のバリデーション
  document.querySelectorAll('input[pattern*="\\d{3}-\\d{4}"]').forEach(input => {
    input.addEventListener('blur', function() {
      const pattern = /^\d{3}-\d{4}$/;
      if (this.value && !pattern.test(this.value)) {
        this.setCustomValidity('正しい郵便番号を入力してください（例: 123-4567）');
      } else {
        this.setCustomValidity('');
      }
    });
  });
  
  // 料金入力のバリデーション
  document.getElementById('current-bill').addEventListener('input', function() {
    const value = parseInt(this.value);
    if (value < 0 || value > 100000) {
      this.setCustomValidity('料金は0円以上10万円以下で入力してください');
    } else {
      this.setCustomValidity('');
    }
  });
  
  // 使用量入力のバリデーション
  for (let i = 1; i <= 12; i++) {
    const input = document.getElementById(`usage-${i}`);
    if (input) {
      input.addEventListener('input', function() {
        const value = parseInt(this.value);
        if (value < 0 || value > 2000) {
          this.setCustomValidity('使用量は0kWh以上2000kWh以下で入力してください');
        } else {
          this.setCustomValidity('');
        }
      });
    }
  }
}

// ==========================================================================
// ユーティリティ関数
// ==========================================================================
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// チャート更新のデバウンス版
const debouncedUpdateUsageChart = debounce(updateUsageChart, 300);

// 使用量入力の変更時にデバウンスされたチャート更新を実行
for (let i = 1; i <= 12; i++) {
  const input = document.getElementById(`usage-${i}`);
  if (input) {
    input.removeEventListener('input', updateUsageChart);
    input.addEventListener('input', debouncedUpdateUsageChart);
  }
}

// ==========================================================================
// アニメーション用CSS追加
// ==========================================================================
const animationStyles = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  .error-message {
    animation: slideInRight 0.3s ease-out;
  }
`;

// スタイルシートに追加
const styleSheet = document.createElement('style');
styleSheet.textContent = animationStyles;
document.head.appendChild(styleSheet);