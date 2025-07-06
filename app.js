// Visitor Management App with Supabase Integration
class VisitorManagementApp {
    constructor() {
        this.currentView = 'guard';
        this.currentUser = null;
        this.isMarathi = false;
        this.currentPhoto = null;
        this.videoStream = null;
        this.realTimeSubscriptions = [];
        this.isOnline = navigator.onLine;
        this.offlineQueue = [];
        
        // Initialize Supabase
        this.initSupabase();
        this.init();
    }

    initSupabase() {
        // Supabase configuration - using environment variables or fallback to provided credentials
        const SUPABASE_URL = window.REACT_APP_SUPABASE_URL || 'https://xxqylleusnxwmocyuhix.supabase.co';
        const SUPABASE_ANON_KEY = window.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4cXlsbGV1c254d21vY3l1aGl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3ODU2NDgsImV4cCI6MjA2NzM2MTY0OH0.OGXnOh_jqkbCIusIESntinjVlhWpxM4S61A5vN2II7w';
        
        try {
            this.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase initialized successfully');
            this.showConnectionStatus('connected');
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
            this.showConnectionStatus('disconnected');
        }
    }

    async init() {
        this.setupEventListeners();
        this.setupNavigation();
        this.setupTabs();
        this.setupPhotoCapture();
        this.setupNetworkListeners();
        this.populateDropdowns();
        this.showView('guard');
        this.updateUI();
        await this.setupRealTimeSubscriptions();
        this.registerServiceWorker();
    }

    setupEventListeners() {
        // Sidebar navigation
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                this.switchView(view);
            });
        });

        // Language toggle
        const languageToggle = document.getElementById('languageToggle');
        if (languageToggle) {
            languageToggle.addEventListener('click', () => {
                this.toggleLanguage();
            });
        }

        // Visitor form submission
        const visitorForm = document.getElementById('visitorForm');
        if (visitorForm) {
            visitorForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitVisitorRequest();
            });
        }

        // Photo capture
        const takePhotoBtn = document.getElementById('takePhoto');
        if (takePhotoBtn) {
            takePhotoBtn.addEventListener('click', () => {
                this.openPhotoModal();
            });
        }

        // Resident registration
        const residentForm = document.getElementById('residentRegForm');
        if (residentForm) {
            residentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.registerResident();
            });
        }

        // Resident logout
        const residentLogout = document.getElementById('residentLogout');
        if (residentLogout) {
            residentLogout.addEventListener('click', () => {
                this.logoutResident();
            });
        }

        // Admin search
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.searchVisitorRecords();
            });
        }

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });
    }

    setupNavigation() {
        // Add mobile menu toggle
        if (!document.querySelector('.mobile-menu-toggle')) {
            const menuToggle = document.createElement('button');
            menuToggle.className = 'mobile-menu-toggle';
            menuToggle.innerHTML = '☰';
            menuToggle.addEventListener('click', () => this.toggleSidebar());
            document.body.appendChild(menuToggle);
        }
    }

    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                const parentContainer = btn.closest('.guard-interface') || btn.closest('.resident-interface');
                
                if (!parentContainer) return;
                
                // Update tab buttons
                parentContainer.querySelectorAll('.tab-btn').forEach(tab => tab.classList.remove('active'));
                btn.classList.add('active');
                
                // Update tab content
                parentContainer.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                const targetContent = parentContainer.querySelector(`#${tabName}`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
                
                // Update content based on tab
                if (tabName === 'pending-requests') {
                    this.updatePendingRequests();
                } else if (tabName === 'pending-approvals') {
                    this.updatePendingApprovals();
                } else if (tabName === 'visitor-history') {
                    this.updateVisitorHistory();
                }
            });
        });
    }

    setupPhotoCapture() {
        const captureBtn = document.getElementById('captureBtn');
        const retakeBtn = document.getElementById('retakeBtn');
        const savePhotoBtn = document.getElementById('savePhotoBtn');
        const closePhotoModal = document.getElementById('closePhotoModal');

        if (captureBtn) captureBtn.addEventListener('click', () => this.capturePhoto());
        if (retakeBtn) retakeBtn.addEventListener('click', () => this.retakePhoto());
        if (savePhotoBtn) savePhotoBtn.addEventListener('click', () => this.savePhoto());
        if (closePhotoModal) closePhotoModal.addEventListener('click', () => this.closePhotoModal());
    }

    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showConnectionStatus('connected');
            this.processOfflineQueue();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showConnectionStatus('disconnected');
        });
    }

    populateDropdowns() {
        const residentFlat = document.getElementById('residentFlat');
        const guardFlatSelect = document.getElementById('flatSelect');
        
        if (residentFlat && guardFlatSelect) {
            residentFlat.innerHTML = guardFlatSelect.innerHTML;
        }
    }

    showConnectionStatus(status) {
        let statusEl = document.querySelector('.connection-status');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.className = 'connection-status';
            document.body.appendChild(statusEl);
        }
        
        statusEl.className = `connection-status ${status}`;
        statusEl.textContent = status === 'connected' ? 'Online' : 'Offline';
        
        if (status === 'disconnected') {
            setTimeout(() => {
                if (statusEl) statusEl.remove();
            }, 5000);
        } else {
            setTimeout(() => {
                if (statusEl) statusEl.remove();
            }, 2000);
        }
    }

    async setupRealTimeSubscriptions() {
        if (!this.supabase) return;

        try {
            // Subscribe to visitor requests
            const visitorsSubscription = this.supabase
                .channel('visitors')
                .on('postgres_changes', 
                    { event: '*', schema: 'public', table: 'visitor_requests' },
                    (payload) => {
                        console.log('Visitor request change:', payload);
                        this.handleRealtimeUpdate(payload);
                    }
                )
                .subscribe();

            this.realTimeSubscriptions.push(visitorsSubscription);
            console.log('Real-time subscriptions established');
        } catch (error) {
            console.error('Failed to setup real-time subscriptions:', error);
        }
    }

    handleRealtimeUpdate(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        // Update UI based on the change
        if (this.currentView === 'guard') {
            this.updatePendingRequests();
        } else if (this.currentView === 'resident-dashboard' && this.currentUser) {
            this.updatePendingApprovals();
            this.updateVisitorHistory();
        } else if (this.currentView === 'admin') {
            this.updateAdminStats();
            this.displayVisitorRecords();
        }

        // Show notification for relevant updates
        if (eventType === 'INSERT' && newRecord) {
            if (this.currentUser && newRecord.flat_number === this.currentUser.flat_number) {
                this.showNotification('New visitor approval request', 'info');
            }
        } else if (eventType === 'UPDATE' && newRecord) {
            if (newRecord.status === 'approved') {
                this.showNotification('Visitor request approved', 'success');
            } else if (newRecord.status === 'denied') {
                this.showNotification('Visitor request denied', 'error');
            }
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        if (sidebar && mainContent) {
            sidebar.classList.toggle('active');
            mainContent.classList.toggle('sidebar-open');
        }
    }

    switchView(view) {
        console.log('Switching to view:', view);
        
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector(`[data-view="${view}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Show appropriate view
        if (view === 'resident-login' && this.currentUser) {
            this.showView('resident-dashboard');
        } else {
            this.showView(view);
        }

        this.currentView = view;
        this.updateUI();
        
        // Close sidebar after navigation
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        if (sidebar && mainContent) {
            sidebar.classList.remove('active');
            mainContent.classList.remove('sidebar-open');
        }
    }

    showView(viewName) {
        console.log('Showing view:', viewName);
        
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Show target view
        let targetView;
        if (viewName === 'guard') {
            targetView = document.getElementById('guard-view');
        } else if (viewName === 'resident-login') {
            targetView = document.getElementById('resident-login-view');
        } else if (viewName === 'resident-dashboard') {
            targetView = document.getElementById('resident-dashboard-view');
        } else if (viewName === 'admin') {
            targetView = document.getElementById('admin-view');
        }

        if (targetView) {
            targetView.classList.add('active');
            console.log('View activated:', viewName);
        } else {
            console.error('View not found:', viewName);
        }
    }

    toggleLanguage() {
        this.isMarathi = !this.isMarathi;
        this.updateLanguage();
        console.log('Language toggled to:', this.isMarathi ? 'Marathi' : 'English');
    }

    updateLanguage() {
        const translations = {
            'guard-title': this.isMarathi ? 'सुरक्षा रक्षक' : 'Security Guard',
            'photo-label': this.isMarathi ? 'भेटणारा फोटो' : 'Visitor Photo',
            'visitor-name-label': this.isMarathi ? 'भेटणारे नाव' : 'Visitor Name',
            'vehicle-label': this.isMarathi ? 'वाहन तपशील' : 'Vehicle Details',
            'purpose-label': this.isMarathi ? 'भेटीचा उद्देश' : 'Purpose of Visit',
            'flat-label': this.isMarathi ? 'फ्लॅट निवडा' : 'Select Flat',
            'submitBtn': this.isMarathi ? 'विनंती पाठवा' : 'Submit Request'
        };

        // Update text content
        Object.keys(translations).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const submitText = element.querySelector('#submitText');
                if (submitText) {
                    submitText.textContent = translations[id];
                } else {
                    element.textContent = translations[id];
                }
            }
        });

        // Update placeholder text
        const photoPlaceholder = document.getElementById('photo-placeholder');
        if (photoPlaceholder) {
            photoPlaceholder.textContent = this.isMarathi ? 'फोटो घेतलेला नाही' : 'No photo taken';
        }

        // Update language toggle button
        const languageToggle = document.getElementById('languageToggle');
        if (languageToggle) {
            languageToggle.textContent = this.isMarathi ? 'English' : 'मराठी';
        }

        // Update form placeholders
        const visitorNameInput = document.getElementById('visitorName');
        const vehicleInput = document.getElementById('vehicleNumber');
        
        if (visitorNameInput) {
            visitorNameInput.placeholder = this.isMarathi ? 'भेटणारे नाव भरा' : 'Enter visitor name';
        }
        if (vehicleInput) {
            vehicleInput.placeholder = this.isMarathi ? 'वाहन नंबर भरा' : 'Vehicle number';
        }
    }

    async openPhotoModal() {
        const modal = document.getElementById('photoModal');
        const video = document.getElementById('videoStream');
        
        if (!modal || !video) {
            console.error('Photo modal elements not found');
            return;
        }

        try {
            // Request camera permission
            this.videoStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                } 
            });
            
            video.srcObject = this.videoStream;
            modal.classList.add('active');
            
            // Reset button states
            document.getElementById('captureBtn').style.display = 'inline-block';
            document.getElementById('retakeBtn').style.display = 'none';
            document.getElementById('savePhotoBtn').style.display = 'none';
            
            console.log('Photo modal opened successfully');
        } catch (error) {
            console.error('Error accessing camera:', error);
            
            // Fallback: simulate photo capture for demo
            this.simulatePhotoCapture();
            modal.classList.add('active');
        }
    }

    simulatePhotoCapture() {
        // Create a canvas with a placeholder image for demo purposes
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        
        // Draw a simple placeholder
        ctx.fillStyle = '#ddd';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Demo Photo', canvas.width / 2, canvas.height / 2);
        
        this.currentPhoto = canvas.toDataURL('image/jpeg', 0.8);
        
        // Update preview immediately
        const preview = document.getElementById('photoPreview');
        if (preview) {
            preview.innerHTML = `<img src="${this.currentPhoto}" alt="Visitor Photo">`;
        }
        
        // Close modal
        this.closePhotoModal();
        this.showNotification('Demo photo captured', 'success');
    }

    capturePhoto() {
        const video = document.getElementById('videoStream');
        const canvas = document.getElementById('photoCanvas');
        
        if (!video || !canvas) return;
        
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        context.drawImage(video, 0, 0);
        
        // Show captured photo
        video.style.display = 'none';
        canvas.style.display = 'block';
        
        // Update buttons
        document.getElementById('captureBtn').style.display = 'none';
        document.getElementById('retakeBtn').style.display = 'inline-block';
        document.getElementById('savePhotoBtn').style.display = 'inline-block';
    }

    retakePhoto() {
        const video = document.getElementById('videoStream');
        const canvas = document.getElementById('photoCanvas');
        
        if (video && canvas) {
            video.style.display = 'block';
            canvas.style.display = 'none';
            
            // Update buttons
            document.getElementById('captureBtn').style.display = 'inline-block';
            document.getElementById('retakeBtn').style.display = 'none';
            document.getElementById('savePhotoBtn').style.display = 'none';
        }
    }

    savePhoto() {
        const canvas = document.getElementById('photoCanvas');
        if (canvas) {
            this.currentPhoto = canvas.toDataURL('image/jpeg', 0.8);
            
            // Update preview
            const preview = document.getElementById('photoPreview');
            if (preview) {
                preview.innerHTML = `<img src="${this.currentPhoto}" alt="Visitor Photo">`;
            }
            
            this.closePhotoModal();
            this.showNotification('Photo saved successfully', 'success');
        }
    }

    closePhotoModal() {
        const modal = document.getElementById('photoModal');
        const video = document.getElementById('videoStream');
        const canvas = document.getElementById('photoCanvas');
        
        if (modal) {
            modal.classList.remove('active');
        }
        
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }
        
        if (video && canvas) {
            video.style.display = 'block';
            canvas.style.display = 'none';
        }
        
        // Reset buttons
        const captureBtn = document.getElementById('captureBtn');
        const retakeBtn = document.getElementById('retakeBtn');
        const savePhotoBtn = document.getElementById('savePhotoBtn');
        
        if (captureBtn) captureBtn.style.display = 'inline-block';
        if (retakeBtn) retakeBtn.style.display = 'none';
        if (savePhotoBtn) savePhotoBtn.style.display = 'none';
    }

    async uploadPhoto(file) {
        if (!this.supabase || !file) return null;

        try {
            const fileName = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
            const { data, error } = await this.supabase.storage
                .from('visitor-photos')
                .upload(fileName, file);

            if (error) throw error;

            // Get public URL
            const { data: urlData } = this.supabase.storage
                .from('visitor-photos')
                .getPublicUrl(fileName);

            return urlData.publicUrl;
        } catch (error) {
            console.error('Error uploading photo:', error);
            return null;
        }
    }

    async submitVisitorRequest() {
        const submitBtn = document.getElementById('submitBtn');
        const submitLoading = document.getElementById('submitLoading');
        const submitText = document.getElementById('submitText');
        
        // Show loading state
        submitBtn.disabled = true;
        if (submitLoading) submitLoading.classList.remove('hidden');
        if (submitText) submitText.textContent = 'Submitting...';

        try {
            const visitorName = document.getElementById('visitorName').value;
            const vehicleType = document.getElementById('vehicleType').value;
            const vehicleNumber = document.getElementById('vehicleNumber').value;
            const purpose = document.getElementById('purposeOfVisit').value;
            const flatNumber = document.getElementById('flatSelect').value;
            
            if (!visitorName || !flatNumber) {
                throw new Error('Please fill all required fields');
            }
            
            if (!this.currentPhoto) {
                throw new Error('Please take a visitor photo');
            }

            let photoUrl = null;
            
            // Upload photo if online
            if (this.isOnline && this.supabase) {
                // Convert base64 to blob
                const response = await fetch(this.currentPhoto);
                const blob = await response.blob();
                photoUrl = await this.uploadPhoto(blob);
            }

            const requestData = {
                visitor_name: visitorName,
                vehicle_type: vehicleType || null,
                vehicle_number: vehicleNumber || null,
                purpose: purpose || 'Other',
                flat_number: flatNumber,
                photo_url: photoUrl || this.currentPhoto,
                status: 'pending',
                created_at: new Date().toISOString(),
                guard_id: 'guard-1'
            };

            if (this.isOnline && this.supabase) {
                // Submit to Supabase
                const { data, error } = await this.supabase
                    .from('visitor_requests')
                    .insert([requestData])
                    .select();

                if (error) throw error;
                
                console.log('Visitor request submitted:', data);
            } else {
                // Queue for offline processing
                this.offlineQueue.push(requestData);
                localStorage.setItem('visitorAppOfflineQueue', JSON.stringify(this.offlineQueue));
            }
            
            // Clear form
            document.getElementById('visitorForm').reset();
            const preview = document.getElementById('photoPreview');
            if (preview) {
                preview.innerHTML = '<span id="photo-placeholder">No photo taken</span>';
            }
            this.currentPhoto = null;
            
            this.showNotification('Request sent successfully!', 'success');
            this.updateUI();

        } catch (error) {
            console.error('Error submitting visitor request:', error);
            this.showNotification(error.message, 'error');
        } finally {
            // Reset loading state
            submitBtn.disabled = false;
            if (submitLoading) submitLoading.classList.add('hidden');
            if (submitText) submitText.textContent = this.isMarathi ? 'विनंती पाठवा' : 'Submit Request';
        }
    }

    async registerResident() {
        const residentForm = document.getElementById('residentRegForm');
        const submitBtn = residentForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading"></span> Processing...';

        try {
            const phone = document.getElementById('residentPhone').value.trim();
            const email = document.getElementById('residentEmail').value.trim();
            const flatNumber = document.getElementById('residentFlat').value;
            
            if (!phone || !email || !flatNumber) {
                throw new Error('Please fill all fields');
            }
            
            if (phone.length !== 10 || !/^\d+$/.test(phone)) {
                throw new Error('Please enter a valid 10-digit phone number');
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new Error('Please enter a valid email address');
            }

            if (this.supabase && this.isOnline) {
                // Check if resident already exists
                const { data: existingResident } = await this.supabase
                    .from('residents')
                    .select('*')
                    .eq('phone', phone)
                    .single();

                if (existingResident) {
                    this.currentUser = existingResident;
                } else {
                    // Create new resident
                    const { data, error } = await this.supabase
                        .from('residents')
                        .insert([{
                            phone,
                            email,
                            flat_number: flatNumber,
                            created_at: new Date().toISOString()
                        }])
                        .select()
                        .single();

                    if (error) throw error;
                    this.currentUser = data;
                }
            } else {
                // Offline mode - use local storage
                this.currentUser = {
                    id: Date.now(),
                    phone,
                    email,
                    flat_number: flatNumber,
                    created_at: new Date().toISOString()
                };
            }
            
            this.showView('resident-dashboard');
            this.updateResidentInfo();
            this.showNotification('Login successful!', 'success');

        } catch (error) {
            console.error('Error registering resident:', error);
            this.showNotification(error.message, 'error');
        } finally {
            // Reset loading state
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    updateResidentInfo() {
        const residentInfo = document.getElementById('residentInfo');
        if (residentInfo && this.currentUser) {
            residentInfo.textContent = `${this.currentUser.flat_number} | ${this.currentUser.phone}`;
        }
    }

    logoutResident() {
        this.currentUser = null;
        this.switchView('guard');
        this.showNotification('Logged out successfully', 'success');
    }

    async updatePendingRequests() {
        const pendingList = document.getElementById('pendingList');
        if (!pendingList) return;
        
        try {
            let pendingRequests = [];
            
            if (this.supabase && this.isOnline) {
                const { data, error } = await this.supabase
                    .from('visitor_requests')
                    .select('*')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                pendingRequests = data || [];
            }
            
            if (pendingRequests.length === 0) {
                pendingList.innerHTML = '<p class="no-requests">No pending requests</p>';
                return;
            }
            
            pendingList.innerHTML = pendingRequests.map(request => `
                <div class="request-card">
                    <div class="request-header">
                        <span class="request-id">#${request.id}</span>
                        <span class="request-time">${new Date(request.created_at).toLocaleString()}</span>
                    </div>
                    <div class="request-details">
                        <div class="request-photo">
                            <img src="${request.photo_url}" alt="Visitor Photo" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiNkZGQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMmMxLjEgMCAyIC45IDIgMnMtLjkgMi0yIDItMi0uOS0yLTIgLjktMiAyLTJ6bTkgOWMuMzggMCAuNjMuNzUuMjUgMS4xTDE0LjI1IDE3IDE5IDEybC0zIDNjLS4yNS4yNS0uNzUgMC0uNzUtLjI1VjEwaC02djMuNzVjMCAuMjUtLjUuNS0uNzUuMjVsLTMtM0w5IDEybDQuNzUtNC45Yy0uMzgtLjM1LS4xMy0xLjEuMjUtMS4xaDh6bS0xIDVsLTQgNEg2VjIwaDEwdjF6Ii8+PC9zdmc+'">
                        </div>
                        <div class="request-info">
                            <div class="request-info-item">
                                <span class="request-info-label">Name:</span>
                                <span>${request.visitor_name}</span>
                            </div>
                            <div class="request-info-item">
                                <span class="request-info-label">Vehicle:</span>
                                <span>${request.vehicle_type ? `${request.vehicle_type} - ${request.vehicle_number}` : 'N/A'}</span>
                            </div>
                            <div class="request-info-item">
                                <span class="request-info-label">Purpose:</span>
                                <span>${request.purpose}</span>
                            </div>
                            <div class="request-info-item">
                                <span class="request-info-label">Flat:</span>
                                <span>${request.flat_number}</span>
                            </div>
                        </div>
                    </div>
                    <div class="request-actions">
                        <span class="status status-pending">Pending Approval</span>
                        ${request.status === 'approved' ? 
                            `<button class="btn btn--allow-entry" onclick="app.allowEntry(${request.id})">Allow Entry</button>` : 
                            `<button class="btn btn--secondary" disabled>Waiting for Approval</button>`
                        }
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error updating pending requests:', error);
            pendingList.innerHTML = '<p class="no-requests">Error loading requests</p>';
        }
    }

    async updatePendingApprovals() {
        if (!this.currentUser) return;
        
        const approvalList = document.getElementById('approvalList');
        if (!approvalList) return;
        
        try {
            let pendingApprovals = [];
            
            if (this.supabase && this.isOnline) {
                const { data, error } = await this.supabase
                    .from('visitor_requests')
                    .select('*')
                    .eq('flat_number', this.currentUser.flat_number)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                pendingApprovals = data || [];
            }
            
            if (pendingApprovals.length === 0) {
                approvalList.innerHTML = '<p class="no-requests">No pending approvals</p>';
                return;
            }
            
            approvalList.innerHTML = pendingApprovals.map(request => `
                <div class="request-card">
                    <div class="request-header">
                        <span class="request-id">#${request.id}</span>
                        <span class="request-time">${new Date(request.created_at).toLocaleString()}</span>
                    </div>
                    <div class="request-details">
                        <div class="request-photo">
                            <img src="${request.photo_url}" alt="Visitor Photo" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiNkZGQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMmMxLjEgMCAyIC45IDIgMnMtLjkgMi0yIDItMi0uOS0yLTIgLjktMiAyLTJ6bTkgOWMuMzggMCAuNjMuNzUuMjUgMS4xTDE0LjI1IDE3IDE5IDEybC0zIDNjLS4yNS4yNS0uNzUgMC0uNzUtLjI1VjEwaC02djMuNzVjMCAuMjUtLjUuNS0uNzUuMjVsLTMtM0w5IDEybDQuNzUtNC45Yy0uMzgtLjM1LS4xMy0xLjEuMjUtMS4xaDh6bS0xIDVsLTQgNEg2VjIwaDEwdjF6Ii8+PC9zdmc+'">
                        </div>
                        <div class="request-info">
                            <div class="request-info-item">
                                <span class="request-info-label">Name:</span>
                                <span>${request.visitor_name}</span>
                            </div>
                            <div class="request-info-item">
                                <span class="request-info-label">Vehicle:</span>
                                <span>${request.vehicle_type ? `${request.vehicle_type} - ${request.vehicle_number}` : 'N/A'}</span>
                            </div>
                            <div class="request-info-item">
                                <span class="request-info-label">Purpose:</span>
                                <span>${request.purpose}</span>
                            </div>
                        </div>
                    </div>
                    <div class="request-actions">
                        <button class="btn btn--approve" onclick="app.approveRequest(${request.id})">Approve</button>
                        <button class="btn btn--deny" onclick="app.denyRequest(${request.id})">Deny</button>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error updating pending approvals:', error);
            approvalList.innerHTML = '<p class="no-requests">Error loading approvals</p>';
        }
    }

    async updateVisitorHistory() {
        if (!this.currentUser) return;
        
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        
        try {
            let history = [];
            
            if (this.supabase && this.isOnline) {
                const { data, error } = await this.supabase
                    .from('visitor_requests')
                    .select('*')
                    .eq('flat_number', this.currentUser.flat_number)
                    .neq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (error) throw error;
                history = data || [];
            }
            
            if (history.length === 0) {
                historyList.innerHTML = '<p class="no-requests">No visitor history</p>';
                return;
            }
            
            historyList.innerHTML = history.map(request => `
                <div class="request-card">
                    <div class="request-header">
                        <span class="request-id">#${request.id}</span>
                        <span class="request-time">${new Date(request.created_at).toLocaleString()}</span>
                    </div>
                    <div class="request-details">
                        <div class="request-photo">
                            <img src="${request.photo_url}" alt="Visitor Photo" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiNkZGQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMmMxLjEgMCAyIC45IDIgMnMtLjkgMi0yIDItMi0uOS0yLTIgLjktMiAyLTJ6bTkgOWMuMzggMCAuNjMuNzUuMjUgMS4xTDE0LjI1IDE3IDE5IDEybC0zIDNjLS4yNS4yNS0uNzUgMC0uNzUtLjI1VjEwaC02djMuNzVjMCAuMjUtLjUuNS0uNzUuMjVsLTMtM0w5IDEybDQuNzUtNC45Yy0uMzgtLjM1LS4xMy0xLjEuMjUtMS4xaDh6bS0xIDVsLTQgNEg2VjIwaDEwdjF6Ii8+PC9zdmc+'">
                        </div>
                        <div class="request-info">
                            <div class="request-info-item">
                                <span class="request-info-label">Name:</span>
                                <span>${request.visitor_name}</span>
                            </div>
                            <div class="request-info-item">
                                <span class="request-info-label">Vehicle:</span>
                                <span>${request.vehicle_type ? `${request.vehicle_type} - ${request.vehicle_number}` : 'N/A'}</span>
                            </div>
                            <div class="request-info-item">
                                <span class="request-info-label">Purpose:</span>
                                <span>${request.purpose}</span>
                            </div>
                            <div class="request-info-item">
                                <span class="request-info-label">Status:</span>
                                <span class="status status-${request.status}">
                                    ${request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error updating visitor history:', error);
            historyList.innerHTML = '<p class="no-requests">Error loading history</p>';
        }
    }

    async approveRequest(requestId) {
        try {
            if (this.supabase && this.isOnline) {
                const { error } = await this.supabase
                    .from('visitor_requests')
                    .update({ 
                        status: 'approved',
                        approved_at: new Date().toISOString(),
                        approved_by: this.currentUser?.id 
                    })
                    .eq('id', requestId);

                if (error) throw error;
            }
            
            this.updatePendingApprovals();
            this.showNotification('Request approved successfully', 'success');
        } catch (error) {
            console.error('Error approving request:', error);
            this.showNotification('Error approving request', 'error');
        }
    }

    async denyRequest(requestId) {
        try {
            if (this.supabase && this.isOnline) {
                const { error } = await this.supabase
                    .from('visitor_requests')
                    .update({ 
                        status: 'denied',
                        denied_at: new Date().toISOString(),
                        denied_by: this.currentUser?.id 
                    })
                    .eq('id', requestId);

                if (error) throw error;
            }
            
            this.updatePendingApprovals();
            this.showNotification('Request denied', 'warning');
        } catch (error) {
            console.error('Error denying request:', error);
            this.showNotification('Error denying request', 'error');
        }
    }

    async allowEntry(requestId) {
        try {
            if (this.supabase && this.isOnline) {
                const { error } = await this.supabase
                    .from('visitor_requests')
                    .update({ 
                        entry_allowed: true,
                        entry_time: new Date().toISOString() 
                    })
                    .eq('id', requestId);

                if (error) throw error;
            }
            
            this.updatePendingRequests();
            this.showNotification('Entry allowed', 'success');
        } catch (error) {
            console.error('Error allowing entry:', error);
            this.showNotification('Error allowing entry', 'error');
        }
    }

    async updateAdminStats() {
        try {
            if (!this.supabase || !this.isOnline) {
                // Show default values for offline
                document.getElementById('todayVisitors').textContent = '0';
                document.getElementById('pendingApprovals').textContent = '0';
                document.getElementById('approvedToday').textContent = '0';
                document.getElementById('deniedToday').textContent = '0';
                return;
            }

            const today = new Date().toDateString();
            const todayISO = new Date(today).toISOString().split('T')[0];
            
            // Get today's visitors
            const { data: todayVisitors } = await this.supabase
                .from('visitor_requests')
                .select('*')
                .gte('created_at', todayISO)
                .lt('created_at', new Date(new Date(todayISO).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
            
            // Get pending approvals
            const { data: pendingApprovals } = await this.supabase
                .from('visitor_requests')
                .select('*')
                .eq('status', 'pending');
            
            // Update stats
            document.getElementById('todayVisitors').textContent = todayVisitors?.length || 0;
            document.getElementById('pendingApprovals').textContent = pendingApprovals?.length || 0;
            document.getElementById('approvedToday').textContent = todayVisitors?.filter(r => r.status === 'approved').length || 0;
            document.getElementById('deniedToday').textContent = todayVisitors?.filter(r => r.status === 'denied').length || 0;

        } catch (error) {
            console.error('Error updating admin stats:', error);
        }
    }

    async searchVisitorRecords() {
        const wing = document.getElementById('wingFilter').value;
        const date = document.getElementById('dateFilter').value;
        
        try {
            let query = this.supabase.from('visitor_requests').select('*');
            
            if (wing) {
                query = query.like('flat_number', `${wing}%`);
            }
            
            if (date) {
                const startDate = new Date(date).toISOString().split('T')[0];
                const endDate = new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                query = query.gte('created_at', startDate).lt('created_at', endDate);
            }
            
            const { data: records, error } = await query.order('created_at', { ascending: false }).limit(100);
            
            if (error) throw error;
            this.displayVisitorRecords(records || []);
            
        } catch (error) {
            console.error('Error searching visitor records:', error);
            this.showNotification('Error searching records', 'error');
        }
    }

    async displayVisitorRecords(records = null) {
        const recordsContainer = document.getElementById('visitorRecords');
        if (!recordsContainer) return;
        
        try {
            if (records === null && this.supabase && this.isOnline) {
                const { data, error } = await this.supabase
                    .from('visitor_requests')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (error) throw error;
                records = data || [];
            } else if (records === null) {
                records = [];
            }
            
            if (records.length === 0) {
                recordsContainer.innerHTML = '<p class="no-requests">No visitor records found</p>';
                return;
            }
            
            recordsContainer.innerHTML = records.map(record => `
                <div class="request-card">
                    <div class="request-header">
                        <span class="request-id">#${record.id}</span>
                        <span class="request-time">${new Date(record.created_at).toLocaleString()}</span>
                    </div>
                    <div class="request-details">
                        <div class="request-photo">
                            <img src="${record.photo_url}" alt="Visitor Photo" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiNkZGQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMmMxLjEgMCAyIC45IDIgMnMtLjkgMi0yIDItMi0uOS0yLTIgLjktMiAyLTJ6bTkgOWMuMzggMCAuNjMuNzUuMjUgMS4xTDE0LjI1IDE3IDE5IDEybC0zIDNjLS4yNS4yNS0uNzUgMC0uNzUtLjI1VjEwaC02djMuNzVjMCAuMjUtLjUuNS0uNzUuMjVsLTMtM0w5IDEybDQuNzUtNC45Yy0uMzgtLjM1LS4xMy0xLjEuMjUtMS4xaDh6bS0xIDVsLTQgNEg2VjIwaDEwdjF6Ii8+PC9zdmc+'">
                        </div>
                        <div class="request-info">
                            <div class="request-info-item">
                                <span class="request-info-label">Name:</span>
                                <span>${record.visitor_name}</span>
                            </div>
                            <div class="request-info-item">
                                <span class="request-info-label">Vehicle:</span>
                                <span>${record.vehicle_type ? `${record.vehicle_type} - ${record.vehicle_number}` : 'N/A'}</span>
                            </div>
                            <div class="request-info-item">
                                <span class="request-info-label">Purpose:</span>
                                <span>${record.purpose}</span>
                            </div>
                            <div class="request-info-item">
                                <span class="request-info-label">Flat:</span>
                                <span>${record.flat_number}</span>
                            </div>
                            <div class="request-info-item">
                                <span class="request-info-label">Status:</span>
                                <span class="status status-${record.status}">
                                    ${record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error displaying visitor records:', error);
            recordsContainer.innerHTML = '<p class="no-requests">Error loading records</p>';
        }
    }

    async processOfflineQueue() {
        if (!this.isOnline || !this.supabase || this.offlineQueue.length === 0) return;

        console.log('Processing offline queue:', this.offlineQueue.length, 'items');
        
        for (const item of this.offlineQueue) {
            try {
                const { data, error } = await this.supabase
                    .from('visitor_requests')
                    .insert([item])
                    .select();

                if (error) throw error;
                console.log('Offline item processed:', data);
            } catch (error) {
                console.error('Error processing offline item:', error);
            }
        }
        
        // Clear the queue
        this.offlineQueue = [];
        localStorage.removeItem('visitorAppOfflineQueue');
        this.showNotification('Offline data synced', 'success');
    }

    updateUI() {
        if (this.currentView === 'guard') {
            this.updatePendingRequests();
        } else if (this.currentView === 'resident-dashboard' && this.currentUser) {
            this.updatePendingApprovals();
            this.updateVisitorHistory();
            this.updateResidentInfo();
        } else if (this.currentView === 'admin') {
            this.updateAdminStats();
            this.displayVisitorRecords();
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    closeModal(modal) {
        if (modal) {
            modal.classList.remove('active');
            
            if (modal.id === 'photoModal') {
                this.closePhotoModal();
            }
        }
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('Service Worker registered successfully:', registration.scope);
                })
                .catch((error) => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    window.app = new VisitorManagementApp();
    
    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const menuToggle = document.querySelector('.mobile-menu-toggle');
        
        if (sidebar && !sidebar.contains(e.target) && 
            (!sidebarToggle || !sidebarToggle.contains(e.target)) && 
            (!menuToggle || !menuToggle.contains(e.target))) {
            sidebar.classList.remove('active');
            const mainContent = document.getElementById('mainContent');
            if (mainContent) {
                mainContent.classList.remove('sidebar-open');
            }
        }
    });
    
    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            window.app.closeModal(e.target);
        }
    });
});