# 🔥 FireProtect  
### Smart IoT-Based Fire Detection & Emergency Alert System  

---

## 📌 Overview  

**FireProtect** is a real-time IoT-powered fire detection and emergency alert platform designed to reduce response delays during fire incidents.

The system leverages an **ESP32 microcontroller + cloud monitoring + AI-assisted web dashboard** to automatically notify nearby fire stations and provide live location tracking via Google Maps integration.

---

## 🚀 Key Features  

- ✅ Real-time fire detection using IoT sensors  
- ✅ Cloud-based live monitoring (ThingSpeak)  
- ✅ Instant alert generation on web dashboard  
- ✅ Google Maps API integration for live location tracking  
- ✅ Role-based authentication (User & Fire Authority)  
- ✅ Authority approval workflow before monitoring activation  
- ✅ Reduced emergency dispatch delay  

---

## 🏗️ System Architecture  

---

## 🛠️ Tech Stack  

### 🔹 Hardware  
- ESP32 Microcontroller  
- Flame / Temperature Sensors  
- Arduino IDE  

### 🔹 Cloud & APIs  
- ThingSpeak Cloud  
- Google Maps API  

### 🔹 Frontend  
- Vite  
- React  
- TypeScript  
- Tailwind CSS  
- shadcn-ui  
- Lovable (AI-assisted UI development)  

---

## 🔄 Workflow  

1. Sensors detect abnormal temperature/fire conditions.  
2. ESP32 sends real-time readings to ThingSpeak Cloud.  
3. Web dashboard continuously fetches cloud data.  
4. If threshold exceeds → automatic fire alert triggered.  
5. Nearby fire station receives notification.  
6. Location displayed via Google Maps for quick dispatch.  
7. New users register property → authority approves → monitoring begins.  

---

## 📷 Screenshots  

*(Add screenshots in a `/screenshots` folder and update paths below)*  

### 🖥️ Dashboard  
![Dashboard Screenshot](screenshots/dashboard.png)

### 🚨 Fire Alert Triggered  
![Alert Screenshot](screenshots/alert.png)

### 📍 Live Location Tracking  
![Map Screenshot](screenshots/map.png)

---

## 💻 Local Development Setup  

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate into project folder
cd fireprotect

# Install dependencies
npm install

# Start development server
npm run dev
