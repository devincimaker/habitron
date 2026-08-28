import ExpoModulesCore

#if canImport(AlarmKit)
import AlarmKit
import AppIntents
import SwiftUI
#endif

/// Deliberately not the brand orange: a routine alarm should not read as
/// Apple's Clock going off.
private let alarmTint = (red: 116.0 / 255, green: 198.0 / 255, blue: 157.0 / 255)

/// One routine start time. Every day of the routine that rings at this time
/// travels in `weekdays`, so a routine with two times is two alarms.
struct RoutineAlarmSpec: Record {
  @Field var id: String = ""
  @Field var sectionId: String = ""
  @Field var title: String = ""
  @Field var hour: Int = 0
  @Field var minute: Int = 0
  /// 'Sun'…'Sat', the app's HABIT_WEEKDAYS.
  @Field var weekdays: [String] = []
}

public class RoutineAlarmsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RoutineAlarms")

    Property("isAvailable") { () -> Bool in
      #if canImport(AlarmKit)
        if #available(iOS 26.0, *) { return true }
        return false
      #else
        return false
      #endif
    }

    AsyncFunction("requestAuthorization") { () -> String in
      #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
          return try await RoutineAlarmScheduler.requestAuthorization()
        }
      #endif
      return "denied"
    }

    AsyncFunction("replaceAll") { (alarms: [RoutineAlarmSpec]) in
      #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
          try await RoutineAlarmScheduler.replaceAll(alarms)
          return
        }
      #endif
      // Nothing to do on a device without AlarmKit; the caller checks
      // `isAvailable` before building a plan, so this is only ever a no-op.
    }
  }
}

#if canImport(AlarmKit)

/// Carried on the alarm so the Start intent knows which routine rang.
@available(iOS 26.0, *)
struct RoutineAlarmMetadata: AlarmMetadata {
  let sectionId: String
}

/// The alarm's secondary button. `openAppWhenRun` brings the app up, and the
/// deep link lands on the takeover for this routine.
@available(iOS 26.0, *)
struct StartRoutineIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Start routine"
  static var openAppWhenRun = true

  @Parameter(title: "alarmID")
  var alarmID: String

  @Parameter(title: "sectionId")
  var sectionId: String

  init() {}

  init(alarmID: String, sectionId: String) {
    self.alarmID = alarmID
    self.sectionId = sectionId
  }

  func perform() async throws -> some IntentResult {
    if let uuid = UUID(uuidString: alarmID) {
      try? AlarmManager.shared.stop(id: uuid)
    }
    if let url = URL(string: "habits-coach://routine-start?section=\(sectionId)") {
      await UIApplication.shared.open(url)
    }
    return .result()
  }
}

@available(iOS 26.0, *)
enum RoutineAlarmScheduler {
  static func requestAuthorization() async throws -> String {
    switch AlarmManager.shared.authorizationState {
    case .authorized:
      return "authorized"
    case .denied:
      return "denied"
    default:
      let state = try await AlarmManager.shared.requestAuthorization()
      return state == .authorized ? "authorized" : "denied"
    }
  }

  /// Cancels every routine alarm, then schedules the whole plan again.
  ///
  /// Not a diff, and it cannot usefully be one: AlarmKit rejects `schedule`
  /// for an id it already holds — the daemon logs "Not scheduling an alarm
  /// with a duplicate ID" and throws `invalidInput` — while a scheduled alarm
  /// keeps its title inside an opaque presentation, so there is nothing to
  /// compare an unchanged id against. Every wanted id would be cancelled and
  /// re-made anyway, which is what keeps the lock screen's title current.
  static func replaceAll(_ specs: [RoutineAlarmSpec]) async throws {
    for alarm in try AlarmManager.shared.alarms {
      try AlarmManager.shared.cancel(id: alarm.id)
    }

    for spec in specs {
      guard let id = UUID(uuidString: spec.id) else { continue }
      _ = try await AlarmManager.shared.schedule(id: id, configuration: configuration(for: spec))
    }
  }

  private static func configuration(
    for spec: RoutineAlarmSpec
  ) -> AlarmManager.AlarmConfiguration<RoutineAlarmMetadata> {
    let time = Alarm.Schedule.Relative.Time(hour: spec.hour, minute: spec.minute)
    let schedule = Alarm.Schedule.relative(
      .init(time: time, repeats: .weekly(spec.weekdays.compactMap(weekday(from:))))
    )

    let alert = AlarmPresentation.Alert(
      title: LocalizedStringResource(stringLiteral: spec.title),
      stopButton: .init(
        text: "Dismiss",
        textColor: .white,
        systemImageName: "xmark"
      ),
      secondaryButton: .init(
        text: "Start",
        textColor: .white,
        systemImageName: "play.fill"
      ),
      secondaryButtonBehavior: .custom
    )

    let attributes = AlarmAttributes(
      presentation: AlarmPresentation(alert: alert),
      metadata: RoutineAlarmMetadata(sectionId: spec.sectionId),
      tintColor: Color(red: alarmTint.red, green: alarmTint.green, blue: alarmTint.blue)
    )

    return AlarmManager.AlarmConfiguration(
      schedule: schedule,
      attributes: attributes,
      secondaryIntent: StartRoutineIntent(alarmID: spec.id, sectionId: spec.sectionId),
      sound: .default
    )
  }

  private static func weekday(from name: String) -> Locale.Weekday? {
    switch name {
    case "Sun": return .sunday
    case "Mon": return .monday
    case "Tue": return .tuesday
    case "Wed": return .wednesday
    case "Thu": return .thursday
    case "Fri": return .friday
    case "Sat": return .saturday
    default: return nil
    }
  }
}

#endif
