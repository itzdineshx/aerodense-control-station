/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_ACCESS_TOKEN: string
  readonly VITE_OPENROUTER_API_KEY: string
  readonly VITE_FLIGHT_MQTT_ENABLED: string
  readonly VITE_FLIGHT_MQTT_URL: string
  readonly VITE_FLIGHT_MQTT_CLIENT_ID: string
  readonly VITE_FLIGHT_MQTT_USERNAME: string
  readonly VITE_FLIGHT_MQTT_PASSWORD: string
  readonly VITE_FLIGHT_MQTT_CONTROL_TOPIC: string
  readonly VITE_FLIGHT_MQTT_STATUS_TOPIC: string
  readonly VITE_FLIGHT_MQTT_QOS: string
  readonly VITE_FLIGHT_MQTT_KEEPALIVE_S: string
  readonly VITE_FLIGHT_MQTT_PUBLISH_TIMEOUT_MS: string
  readonly VITE_FLIGHT_THROTTLE_DEFAULT_LEVEL: string
  readonly VITE_AIRCRAFT_CAMERA_IP: string
  readonly VITE_AIRCRAFT_CAMERA_STREAM_PATH: string
  readonly VITE_AIRCRAFT_CAMERA_STREAM_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
