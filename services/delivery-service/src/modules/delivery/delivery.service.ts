import { Injectable, NotFoundException } from "@nestjs/common";

type CourierLocation = {
  courierId: string;
  lat: number;
  lng: number;
  heading?: number;
  updatedAtIso: string;
};

type Candidate = {
  courierId: string;
  distanceKm: number;
  activeOrders: number;
  score: number;
};

@Injectable()
export class DeliveryService {
  private readonly courierLocations = new Map<string, CourierLocation>();
  private readonly courierLoad = new Map<string, number>();

  upsertLocation(courierId: string, lat: number, lng: number, heading?: number): CourierLocation {
    const updated: CourierLocation = {
      courierId,
      lat,
      lng,
      heading,
      updatedAtIso: new Date().toISOString(),
    };
    this.courierLocations.set(courierId, updated);
    if (!this.courierLoad.has(courierId)) this.courierLoad.set(courierId, 0);
    return updated;
  }

  getLocation(courierId: string): CourierLocation {
    const value = this.courierLocations.get(courierId);
    if (!value) throw new NotFoundException("Courier location not found");
    return value;
  }

  setCourierLoad(courierId: string, activeOrders: number): { courierId: string; activeOrders: number } {
    this.courierLoad.set(courierId, Math.max(0, Math.floor(activeOrders)));
    return { courierId, activeOrders: this.courierLoad.get(courierId) || 0 };
  }

  previewDispatch(lat: number, lng: number, limit = 5): { candidates: Candidate[]; totalTrackedCouriers: number } {
    const candidates = Array.from(this.courierLocations.values())
      .map((courier) => {
        const activeOrders = this.courierLoad.get(courier.courierId) || 0;
        const distanceKm = this.distanceKm(lat, lng, courier.lat, courier.lng);
        const score = Number((distanceKm * 0.7 + activeOrders * 2).toFixed(3));
        return {
          courierId: courier.courierId,
          distanceKm: Number(distanceKm.toFixed(3)),
          activeOrders,
          score,
        };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, Math.max(1, Math.min(limit, 20)));

    return {
      candidates,
      totalTrackedCouriers: this.courierLocations.size,
    };
  }

  private distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }
}
