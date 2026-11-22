
let userLat = 16.8302;
let userLon = 75.7100;

let map;
let userMarker;
let placeMarkers = [];
let routeLayer = null;

// Initialize map
map = L.map('map').setView([userLat, userLon], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Get current GPS location

// Get current GPS location
function getLocation() {
    const status = document.getElementById("locationStatus");

    if (!navigator.geolocation) {
        status.textContent = "GPS is not supported by your browser.";
        return;
    }

    status.textContent = "Getting your current location...";

    navigator.geolocation.getCurrentPosition(
        function(position) {
            userLat = position.coords.latitude;
            userLon = position.coords.longitude;

            map.setView([userLat, userLon], 15);

            if (userMarker) {
                map.removeLayer(userMarker);
            }

            userMarker = L.marker([userLat, userLon])
                .addTo(map)
                .bindPopup("Your current location")
                .openPopup();

            status.textContent = "Your current location is detected.";
        },
        function(error) {
            status.textContent = "Unable to get location: " + error.message;
            console.error("Location error:", error);
        },
        {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0
        }
    );
}

// Category search tags
const categories = {

    police: '["amenity"="police"]',

    hospital: '["amenity"~"hospital|clinic"]',

    restaurant: '["amenity"="restaurant"]',

    hotel: '["tourism"="hotel"]',

    mall: '["shop"="mall"]',

    pharmacy: '["amenity"="pharmacy"]',

    government: '["office"="government"]',

    streetlight: '["highway"="street_lamp"]'
};

// Find nearby places
async function findNearby(type) {if (type === "police") {
    const url = `https://www.google.com/maps/search/police+stations/@${userLat},${userLon},13z`;
    window.open(url, "_blank");
    return;
}

    const list = document.getElementById('placesList');
    const count = document.getElementById('resultCount');

    list.innerHTML = '<p>Searching nearby locations...</p>';
    count.textContent = 'Loading map information...';

    const tag = categories[type];

    if (!tag) return;

    let query;

if (type === "police") {
    query = `
        [out:json][timeout:60];
        (
            nwr["amenity"="police"](around:15000,${userLat},${userLon});
            nwr["office"="police"](around:15000,${userLat},${userLon});
            nwr["building"="police"](around:15000,${userLat},${userLon});
        );
        out center tags;
    `;
} else {
    query = `
        [out:json][timeout:60];
        (
            node${tag}(around:5000,${userLat},${userLon});
            way${tag}(around:5000,${userLat},${userLon});
            relation${tag}(around:5000,${userLat},${userLon});
        );
        out center tags;
    `;
}

    try {

        const response = await fetch(
            'https://overpass-api.de/api/interpreter',
            {
                method: 'POST',
                body: query
            }
        );

        if (!response.ok) {
            throw new Error("Map data service unavailable");
        }

        const data = await response.json();

        clearMarkers();

        list.innerHTML = '';

        if (!data.elements || data.elements.length === 0) {

            list.innerHTML =
                '<p>No mapped places found within 5 km. Try another category or area.</p>';

            count.textContent = '0 places found';
            return;
        }

        const places = data.elements.slice(0, 40);

        count.textContent =
            places.length + ' mapped places found within approximately 5 km.';

        places.forEach(place => {

            const lat = place.lat ?? place.center?.lat;
            const lon = place.lon ?? place.center?.lon;

            if (lat == null || lon == null) return;

            const tags = place.tags || {};

            const name = tags.name || "Unnamed location";

            const phone =
                tags.phone ||
                tags['contact:phone'] ||
                tags['phone:mobile'] ||
                "";

            const address = [
                tags['addr:street'],
                tags['addr:city'],
                tags['addr:postcode']
            ].filter(Boolean).join(', ') || "Address not available";

            const distance = calculateDistance(
                userLat, userLon, lat, lon
            );

            const marker = L.marker([lat, lon])
                .addTo(map)
                .bindPopup(`<b>${escapeHTML(name)}</b><br>${distance.toFixed(2)} km away`);

            placeMarkers.push(marker);

            const card = document.createElement('div');
            card.className = 'place-card';

            const heading = document.createElement('h4');
            heading.textContent = name;

            const addressText = document.createElement('p');
            addressText.textContent = address;

            const distanceText = document.createElement('p');
            distanceText.textContent = distance.toFixed(2) + ' km away';

            card.append(heading, addressText, distanceText);

            const actions = document.createElement('div');
            actions.className = 'place-actions';

            const direction = document.createElement('a');
            direction.textContent = 'Get Directions';
            direction.href =
                `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
            direction.target = '_blank';
            direction.rel = 'noopener noreferrer';

            actions.appendChild(direction);

            if (phone) {

                const call = document.createElement('a');
                call.textContent = 'Call Now';
                call.href = 'tel:' + phone;

                actions.appendChild(call);

            } else {

                const unavailable = document.createElement('p');
                unavailable.textContent = 'Phone number not listed';
                actions.appendChild(unavailable);
            }

            card.appendChild(actions);
            list.appendChild(card);

        });

        if (list.innerHTML === '') {
            list.textContent = "No valid location coordinates found.";
        }

    } catch (error) {

        console.error(error);

        list.innerHTML =
            '<p>Unable to load map information. Please try again later.</p>';

        count.textContent = 'Map service error';

    }
}

// Remove previous markers
function clearMarkers() {

    placeMarkers.forEach(marker => map.removeLayer(marker));

    placeMarkers = [];
}

// Distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {

    const R = 6371;

    
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Escape untrusted HTML
function escapeHTML(value) {

    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);

}

// Search destination using Photon
async function searchLocation() {

    const input = document.getElementById('destination').value.trim();

    if (!input) {
        alert("Please enter a destination.");
        return;
    }

    try {

        const response = await fetch(
            `https://photon.komoot.io/api/?q=${encodeURIComponent(input)}&limit=1`
        );

        const data = await response.json();

        if (!data.features.length) {
            alert("Location not found.");
            return;
        }

        const coords = data.features[0].geometry.coordinates;

        const lon = coords[0];
        const lat = coords[1];

        map.setView([lat, lon], 15);

        L.marker([lat, lon])
            .addTo(map)
            .bindPopup("Selected destination")
            .openPopup();

        document.getElementById('locationStatus').textContent =
            "Destination found. You can explore nearby places.";

    } catch (error) {

        alert("Unable to search destination. Try again.");

    }
}

// Share current location

async function shareLocation() {

    const status = document.getElementById("locationStatus");

    if (!navigator.geolocation) {
        alert("Your browser does not support location.");
        return;
    }

    status.textContent = "Getting your current location...";

    navigator.geolocation.getCurrentPosition(
        async function(position) {

            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            const link = `https://www.google.com/maps?q=${lat},${lon}`;

            const message = `My current location: ${link}`;

            try {

                if (navigator.share) {

                    await navigator.share({
                        title: "My SafeHer Location",
                        text: message
                    });

                    status.textContent = "Location sharing opened.";

                } else if (navigator.clipboard && window.isSecureContext) {

                    await navigator.clipboard.writeText(message);

                    alert("Location link copied! You can paste it into WhatsApp.");

                    status.textContent = "Location link copied.";

                } else {

                    window.prompt("Copy and share this location link:", message);

                    status.textContent = "Copy the location link to share.";

                }

            } catch (error) {

                if (error.name === "AbortError") {
                    status.textContent = "Sharing cancelled.";
                } else {
                    window.prompt("Copy your location link:", message);
                    status.textContent = "Copy the link to share your location.";
                }

            }

        },

        function(error) {

            if (error.code === 1) {
                alert("Location permission denied. Please allow location access.");
            } else if (error.code === 2) {
                alert("Your current location is unavailable. Check GPS.");
            } else {
                alert("Location request timed out. Please try again.");
            }

            status.textContent = "Unable to get your location.";

        },

        {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0
        }
    );
}


// Basic assistant - not yet connected to an AI API
function askAssistant() {

    const question =
        document.getElementById('assistantQuestion').value.trim();

    const answer =
        document.getElementById('assistantAnswer');

    if (!question) {
        answer.textContent = "Please enter your question.";
        return;
    }

    const q = question.toLowerCase();

    if (q.includes('police')) {

        answer.textContent =
            "Select Police Stations in the nearby services section to find mapped police stations.";

    } else if (q.includes('hospital')) {

        answer.textContent =
            "Select Hospitals to find nearby medical facilities.";

    } else if (q.includes('restaurant')) {

        answer.textContent =
            "Select Restaurants to discover nearby restaurants.";

    } else if (q.includes('hotel')) {

        answer.textContent =
            "Select Hotels to find nearby accommodation.";

    } else if (q.includes('emergency') || q.includes('help')) {

        answer.textContent =
            "If you are in immediate danger in India, call 112.";

    } else {

        answer.textContent =
            "Try asking about nearby police stations, hospitals, hotels or restaurants.";

    }

}

// Load a default area, initially Vijayapura
map.whenReady(() => {
    L.marker([userLat, userLon])
        .addTo(map)
        .bindPopup("Default map starting point");
});

const API_URL = "http://127.0.0.1:8000";

// Submit a safety report
async function submitSafetyReport() {
    const category = document.getElementById("reportCategory").value;
    const description = document.getElementById("reportDescription").value;
    const status = document.getElementById("reportStatus");

    if (description.trim().length < 5) {
        status.textContent = "Please enter at least 5 characters.";
        return;
    }

    if (!navigator.geolocation) {
        status.textContent = "Location is not supported.";
        return;
    }

    status.textContent = "Getting your location...";

    navigator.geolocation.getCurrentPosition(async (position) => {
        const report = {
            category: category,
            description: description,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        };

        try {
            const response = await fetch(`${API_URL}/reports`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(report)
            });

            if (!response.ok) {
                throw new Error("Could not save report.");
            }

            status.textContent = "Report submitted successfully!";
            document.getElementById("reportDescription").value = "";

            loadCommunityReports();

        } catch (error) {
            status.textContent = error.message;
        }

    }, (error) => {
        status.textContent = "Location error: " + error.message;
    });
}

// Display saved reports
async function loadCommunityReports() {
    const container = document.getElementById("communityReports");

    try {
        const response = await fetch(`${API_URL}/reports`);
        if (!response.ok) throw new Error("Unable to load reports.");

        const reports = await response.json();

        container.replaceChildren();

        if (reports.length === 0) {
            container.textContent = "No reports submitted yet.";
            return;
        }

        reports.forEach(report => {
            const item = document.createElement("div");
            const heading = document.createElement("h4");
            const description = document.createElement("p");

            heading.textContent = report.category;
            description.textContent = report.description;

            item.append(heading, description);
            container.appendChild(item);
        });

    } catch (error) {
        container.textContent = "Could not load reports.";
        console.error(error);
    }
}

// Load reports when the page opens
document.addEventListener("DOMContentLoaded", loadCommunityReports);
