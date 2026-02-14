import { Injectable } from "@nestjs/common";
import { RealtimeEvent } from "@get-caramel/types";
import { Subject } from "rxjs";

@Injectable()
export class RealtimeEventsService {
  private readonly eventsSubject = new Subject<RealtimeEvent>();
  readonly events$ = this.eventsSubject.asObservable();

  emit(event: RealtimeEvent): void {
    this.eventsSubject.next(event);
  }
}
