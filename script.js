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

    function formatInputNumber(e) {
        let value = e.target.value.replace(/\D/g, ""); // Sadece rakamları al
        if(value !== "") {
            e.target.value = Number(value).toLocaleString('tr-TR');
        }
    }
    initialBudgetInput.addEventListener('input', formatInputNumber);
    customAmountInput.addEventListener('input', formatInputNumber);

    const extraBalanceInput = document.getElementById("extra-balance-amount");
    extraBalanceInput.addEventListener('input', formatInputNumber);

    const newQuickBtnInput = document.getElementById("new-quick-btn-val");
    newQuickBtnInput.addEventListener('input', formatInputNumber);

    async function init() {
        scheduleMidnightUpdate()
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
            // Hata olsa bile kurulum ekranını göster ki sayfa boş kalmasın:
            setupScreen.classList.add("active");
            trackerScreen.classList.remove("active");
            alert("Firebase'e bağlanılamadı. Lütfen konsolu kontrol edin.");
        }
    }

    // Sisteme ilk giriş yapıldığında hesaplamalar
    startBtn.addEventListener("click", () => {
        const rawValue = initialBudgetInput.value.replace(/\./g, "");
        const totalBudget = parseFloat(rawValue);
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
            lastUpdateDate: now.toDateString(), // Gün değişimini takip etmek için
            quickButtons: [50, 100, 200, 500], // Varsayılan butonlar
            expenseHistory: [], // Harcama geçmişini tutacak dizi
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

        // Geçmiş dizisi yoksa oluştur (eski veriler için güvenlik önlemi)
        if (!appData.expenseHistory) appData.expenseHistory = [];
        
        // Tarihi saat olmadan al (Örn: 25 Mart 2026)
        const now = new Date();
        const dateString = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        
        // En yeni harcamayı listenin en üstüne (başına) ekliyoruz
        appData.expenseHistory.unshift({
            amount: amount,
            date: dateString
        });

        saveData();
        updateUI();
    };

    // Özel Tutar Ekleme
    window.addCustomExpense = function() {
        const rawValue = customAmountInput.value.replace(/\./g, "");
        const amount = parseFloat(rawValue);
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
            showModal("Süre Doldu", "Ay bitti! Hedefe ulaştınız. Sistem sıfırlanıyor.", resetApp);
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

    function renderQuickButtons() {
        const container = document.getElementById("dynamic-quick-buttons");
        container.innerHTML = "";
        
        // Eğer eskiyse ve quickButtons yoksa varsayılan atayalım
        if (!appData.quickButtons) {
            appData.quickButtons = [50, 100, 200, 500];
            saveData();
        }

        appData.quickButtons.forEach(amount => {
            const btn = document.createElement("button");
            btn.className = "btn quick-btn";
            // Sayıları ekranda binlik ayraçlı gösterelim
            btn.innerText = amount.toLocaleString('tr-TR') + " ₺"; 
            btn.onclick = () => addExpense(amount);
            container.appendChild(btn);
        });
    }

    function updateUI() {
        if (!appData) return;

        dailyBalanceEl.classList.remove("pop-anim");
        void dailyBalanceEl.offsetWidth; // Tarayıcıyı animasyonu sıfırlamaya zorlar (Reflow hilesi)
        dailyBalanceEl.classList.add("pop-anim");
        
        // Bakiye yazdırma
        dailyBalanceEl.textContent = appData.dailyBalance.toFixed(2) + " ₺";
        
        // Eksiye düşüldüyse kırmızı göster. Artıdaysa yeşil.
        dailyBalanceEl.classList.remove("negative", "positive");
        if (appData.dailyBalance < 0) {
            dailyBalanceEl.classList.add("negative");
        } else if (appData.dailyBalance > 0) {
            dailyBalanceEl.classList.add("positive");
        }
        
        baseLimitEl.textContent = appData.baseLimit.toFixed(2);
        totalBudgetLeftEl.textContent = appData.totalBudgetLeft.toFixed(2) + " ₺";
        daysLeftEl.textContent = appData.daysLeft;

        renderQuickButtons();
        renderHistory();
    }

    function showModal(title, message, onOk) {
        const modal = document.getElementById("custom-modal");
        document.getElementById("modal-title").innerText = title;
        document.getElementById("modal-message").innerText = message;
        
        const okBtn = document.getElementById("modal-ok-btn");
        okBtn.onclick = function() {
            modal.classList.remove("active");
            if(onOk) onOk();
        };
        modal.classList.add("active");
    }

    function scheduleMidnightUpdate() {
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
        const timeUntilMidnight = midnight.getTime() - now.getTime();

        setTimeout(() => {
            checkRealDayChange(); // Günü yenile
            updateUI();
            scheduleMidnightUpdate(); // Yarın gece için tekrar kur
        }, timeUntilMidnight);
    }

    window.openManageModal = function() {
        renderManageList();
        document.getElementById("manage-modal").classList.add("active");
    };

    window.closeManageModal = function() {
        document.getElementById("manage-modal").classList.remove("active");
        newQuickBtnInput.value = ""; // Kapatırken inputu temizle
    };

    function renderManageList() {
        const listContainer = document.getElementById("manage-buttons-list");
        listContainer.innerHTML = "";

        if (!appData.quickButtons) appData.quickButtons = [50, 100, 200, 500];

        appData.quickButtons.forEach((amount, index) => {
            const item = document.createElement("div");
            item.className = "manage-item";
            
            const text = document.createElement("span");
            text.innerText = amount.toLocaleString('tr-TR') + " ₺";
            
            const delBtn = document.createElement("button");
            delBtn.className = "delete-btn";
            delBtn.innerText = "Sil";
            delBtn.onclick = () => deleteQuickButton(index);

            item.appendChild(text);
            item.appendChild(delBtn);
            listContainer.appendChild(item);
        });
    }

    window.addNewQuickButton = function() {
        const rawValue = newQuickBtnInput.value.replace(/\./g, "");
        const amount = parseFloat(rawValue);

        if (isNaN(amount) || amount <= 0) {
            alert("Lütfen geçerli bir tutar girin.");
            return;
        }

        // Eğer aynı tutar zaten varsa eklemesin
        if (appData.quickButtons.includes(amount)) {
            alert("Bu tutar zaten listede var.");
            return;
        }

        appData.quickButtons.push(amount);
        // Sayıları küçükten büyüğe sıralayalım daha şık durur
        appData.quickButtons.sort((a, b) => a - b); 
        
        saveData();
        renderManageList(); // Modal içini güncelle
        renderQuickButtons(); // Ana ekranı güncelle
        newQuickBtnInput.value = ""; // İnputu temizle
    };

    window.deleteQuickButton = function(index) {
        appData.quickButtons.splice(index, 1);
        saveData();
        renderManageList();
        renderQuickButtons();
    };

    // Akordeon menüyü açıp kapatma
    window.toggleHistory = function() {
        const content = document.getElementById("history-list");
        const icon = document.getElementById("history-icon");
        
        if (content.classList.contains("open")) {
            content.classList.remove("open");
            icon.style.transform = "rotate(0deg)";
        } else {
            content.classList.add("open");
            icon.style.transform = "rotate(180deg)"; // Oku yukarı döndür
        }
    };

    // Geçmişi HTML içine yerleştirme
    function renderHistory() {
        const list = document.getElementById("history-list");
        list.innerHTML = ""; // İçini temizle

        if (!appData.expenseHistory || appData.expenseHistory.length === 0) {
            list.innerHTML = "<div class='history-item'><span class='history-date'>Henüz harcama bulunmuyor.</span></div>";
            return;
        }

        appData.expenseHistory.forEach(item => {
            const div = document.createElement("div");
            div.className = "history-item";
            // Sayıları noktayla (binlik ayraç) gösterip kırmızı eksi formatına sokuyoruz
            div.innerHTML = `
                <span class="history-date">${item.date}</span>
                <span class="history-amount">-${item.amount.toLocaleString('tr-TR')} ₺</span>
            `;
            list.appendChild(div);
        });
    }

    window.openAddBalanceModal = function() {
        document.getElementById("add-balance-modal").classList.add("active");
    };

    window.closeAddBalanceModal = function() {
        document.getElementById("add-balance-modal").classList.remove("active");
        extraBalanceInput.value = ""; // Kapatınca içini temizle
        document.getElementById("balance-split-switch").checked = false; // Switch'i başa al
    };

    window.confirmAddBalance = function() {
        const rawValue = extraBalanceInput.value.replace(/\./g, "");
        const amount = parseFloat(rawValue);

        if (isNaN(amount) || amount <= 0) {
            alert("Lütfen geçerli bir bakiye tutarı girin.");
            return;
        }

        // Switch sağda mı (true) solda mı (false) kontrol et
        const isSplit = document.getElementById("balance-split-switch").checked;

        if (isSplit) {
            // Sağda: Kalan günlere böl ve ekle
            const dailyAddition = amount / appData.daysLeft;
            appData.baseLimit += dailyAddition; // Taban limiti artır
            appData.dailyBalance += dailyAddition; // Bugünün hakkına da o payı ekle
            appData.totalBudgetLeft += amount; // Toplam kasaya ekle
        } else {
            // Solda: Sadece bugünün bakiyesine ekle (Lump sum)
            appData.dailyBalance += amount;
            appData.totalBudgetLeft += amount;
        }

        saveData();
        updateUI();
        closeAddBalanceModal();
    };

    init();
});