import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import L from 'leaflet';

// Fix for default marker icons not showing up in Leaflet with Webpack/Vite
// See: https://github.com/PaulLeCam/react-leaflet/issues/453
import iconIsRetina from 'leaflet/dist/images/marker-icon-2x.png';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
    iconRetinaUrl: iconIsRetina,
    iconUrl: icon,
    shadowUrl: iconShadow,
});

interface MapProps {
    center?: [number, number];
    zoom?: number;
    className?: string;
    markers?: Array<{
        position: [number, number];
        title: string;
        description?: string;
    }>;
}

const Map = ({
    center = [51.505, -0.09], // Default to London, can be changed
    zoom = 13,
    className = "h-[400px] w-full rounded-lg shadow-md",
    markers = []
}: MapProps) => {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return <div className={`${className} bg-muted animate-pulse flex items-center justify-center`}>Loading Map...</div>;
    }

    return (
        <MapContainer
            center={center}
            zoom={zoom}
            className={className}
            scrollWheelZoom={false}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {markers.map((marker, index) => (
                <Marker key={index} position={marker.position}>
                    <Popup>
                        <div className="font-semibold">{marker.title}</div>
                        {marker.description && <div className="text-sm mt-1">{marker.description}</div>}
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
};

export default Map;
