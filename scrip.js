document.addEventListener("DOMContentLoaded", () => {
    const setupScreen = document.getElementById("setup-screen");
    const trackerScreen = document.getElementById("tracker-screen");
    
    const startBtn = document.getElementById("start-btn");
    const initialBudgetInput = document.getElementById("initial-budget");
    const customAmountInput = document.getElementById("custom-amount");
    
    const dailyBalanceEl = document.getElementById("daily-balance");
    const baseLimitEl = document.getElementById("base-limit");
    const totalBudgetLeftEl = document.getElementById("total-budget-left");
    const daysLeftEl = document.getElementById("days-left");

    async function init() {
        try {
            // Şimdilik test için 'my_budget' adında sabit bir belge kullanıyoruz.
            const docRef = db.collection("budgets").doc("my_budget");
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                appData = docSnap.data();
                checkRealDayChange();
                updateUI();
                setupScreen.classList.remove("active");
                trackerScreen.classList.add("active");
            } else {
                setupScreen.classList.add("active");
                trackerScreen.classList.remove("active");
            }
        } catch (error) {
            console.error("Veri çekilirken hata oluştu:", error);
        }
    }

    // Sisteme ilk giriş yapıldığında hesaplamalar
    startBtn.addEventListener("click", () => {
        const totalBudget = parseFloat(initialBudgetInput.value);
        if (isNaN(totalBudget) || totalBudget <= 0) {
            alert("Lütfen geçerli bir bütçe girin.");
            return;
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        // Bulunduğumuz ayın kaç çektiğini buluyoruz
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Örn: 23 Mart. 31 - 23 = 8 gün (Senin hesaplama mantığınla birebir)
        let daysLeft = daysInMonth - now.getDate();
        if (daysLeft <= 0) daysLeft = 1; // Ayın son günüyse 0'a bölme hatasını önlemek için

        const baseLimit = totalBudget / daysLeft;

        appData = {
            totalBudget: totalBudget,
            totalBudgetLeft: totalBudget,
            daysLeft: daysLeft,
            baseLimit: baseLimit,
            dailyBalance: baseLimit, // İlk gün bakiyesi base limittir
            lastUpdateDate: now.toDateString() // Gün değişimini takip etmek için
        };

        saveData();
        setupScreen.classList.remove("active");
        trackerScreen.classList.add("active");
        updateUI();
    });

    // Harcama Ekleme Fonksiyonu
    window.addExpense = function(amount) {
        appData.dailyBalance -= amount;
        appData.totalBudgetLeft -= amount;
        saveData();
        updateUI();
    };

    // Özel Tutar Ekleme
    window.addCustomExpense = function() {
        const amount = parseFloat(customAmountInput.value);
        if (isNaN(amount) || amount <= 0) return;
        addExpense(amount);
        customAmountInput.value = "";
    };

    // Gerçek zamanlı gün değişim kontrolü (Kullanıcı ertesi gün siteye girdiğinde çalışır)
    function checkRealDayChange() {
        const now = new Date();
        const todayStr = now.toDateString();
        
        if (appData.lastUpdateDate !== todayStr) {
            const lastDateObj = new Date(appData.lastUpdateDate);
            const diffTime = Math.abs(now - lastDateObj);
            const passedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (passedDays > 0) {
                applyNextDayLogic(passedDays);
                appData.lastUpdateDate = todayStr;
                saveData();
            }
        }
    }

    // Test Butonu İçin Manuel Gün Atlama
    window.simulateNextDay = function() {
        applyNextDayLogic(1);
        saveData();
        updateUI();
    };

    // Ertesi güne geçiş mantığı (Asıl sihir burada gerçekleşiyor)
    function applyNextDayLogic(daysPassed) {
        appData.daysLeft -= daysPassed;
        
        if (appData.daysLeft <= 0) {
            alert("Ay bitti! Hedefe ulaştınız. Sistem sıfırlanıyor.");
            resetApp();
            return;
        }

        // Bahsettiğin örnek: Bugün bakiye -2000 ise ve yarının limiti 1000 ise,
        // Yeni bakiye: -2000 + 1000 = -1000 olur. Yani dünün eksi limiti yarını da yer.
        appData.dailyBalance = appData.dailyBalance + (appData.baseLimit * daysPassed);
    }

    window.resetApp = function() {
        // Firebase'den belgeyi siliyoruz
        db.collection("budgets").doc("my_budget").delete().then(() => {
            appData = null;
            initialBudgetInput.value = "";
            setupScreen.classList.add("active");
            trackerScreen.classList.remove("active");
        }).catch(error => console.error("Sıfırlama hatası:", error));
    };

    function saveData() {
        // Firebase'e kaydediyoruz
        if (appData) {
            db.collection("budgets").doc("my_budget").set(appData)
              .catch(error => console.error("Kaydetme hatası:", error));
        }
    }

    function updateUI() {
        if (!appData) return;
        
        // Bakiye yazdırma
        dailyBalanceEl.textContent = appData.dailyBalance.toFixed(2) + " ₺";
        
        // Eksiye düşüldüyse kırmızı göster
        if (appData.dailyBalance < 0) {
            dailyBalanceEl.classList.add("negative");
        } else {
            dailyBalanceEl.classList.remove("negative");
        }
        
        baseLimitEl.textContent = appData.baseLimit.toFixed(2);
        totalBudgetLeftEl.textContent = appData.totalBudgetLeft.toFixed(2) + " ₺";
        daysLeftEl.textContent = appData.daysLeft;
    }

    init();
});