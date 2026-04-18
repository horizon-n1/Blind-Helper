 
#include "Navigation.h"

void setupNavigation() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.begin(9600);
}

void runNavigationLoop() {
  long duration;
  int distance;

  // 1. Trigger the sensor
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // 2. Measure Echo
  duration = pulseIn(ECHO_PIN, HIGH);
  distance = duration * 0.034 / 2;

  // 3. The "Peaceful" Logic (Detection under 50cm)
  if (distance > 0 && distance < 50) {
    tone(BUZZER_PIN, PEACEFUL_NOTE, 100); 
    
    // Proximity logic: Faster pulses as the user gets closer
    int delayTime = map(distance, 0, 100, 100, 800); 
    delay(delayTime);
  } else {
    noTone(BUZZER_PIN); 
  }

  // 4. Debugging
  Serial.print("Distance: ");
  Serial.println(distance);
  delay(50); 
}