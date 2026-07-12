# Device Gateway

Nodes for interacting with devices through the MFGx Device Gateway -- executing device functions, printing, subscribing to device events, and managing tags and workcenter modes.

---

## Execute Device Function V2

| | |
|---|---|
| **Name** | `executeDeviceFunctionV2` |
| **Title** | Execute Device Function |
| **Responsibility** | transition |
| **Description** | Executes a function on a device through the MFGx Device Gateway. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `deviceIdTransform` | string | -- | Yes | The device to execute the function on. |
| `functionIdTransform` | string | -- | Yes | Which function to execute on the device. |
| `requestTransform` | object | -- | No | A series of transforms to produce the payload of the request to send to the device function. |
| `functionTimeoutSecondsTransform` | string | -- | No | Transform producing timeout in seconds. Defaults to the timeout defined on the function record. |
| `requestIdTransform` | string | -- | No | Transform producing a request ID. Auto-generated when not provided. |

Standard output port.

---

## Device Print Document (Print Data)

| | |
|---|---|
| **Name** | `devicePrintDocument` |
| **Title** | Print Data |
| **Responsibility** | transition |
| **Description** | Prints a document through the MFGx Device Gateway. The data must be base-64 encoded. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `deviceIdTransform` | string | -- | Yes | The printer to send the document to. |
| `dataTransform` | string | -- | Yes | Transform producing the base-64 encoded document to print. |
| `filenameTransform` | string | -- | No | The name of the file. The file extension determines how the gateway handles the document. Defaults to a random ID (assumed PDF). |
| `functionTimeoutSecondsTransform` | string | -- | No | Transform producing timeout in seconds. |
| `requestIdTransform` | string | -- | No | Transform producing a request ID. Auto-generated when not provided. |

Standard output port.

**Validation:** requireInputNode

---

## Device Print File (Print File)

| | |
|---|---|
| **Name** | `devicePrintFile` |
| **Title** | Print File |
| **Responsibility** | transition |
| **Description** | Prints an MFGx file through the MFGx Device Gateway. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `deviceIdTransform` | string | -- | Yes | The printer to send the document to. |
| `fileIdTransform` | string | -- | Yes | The file to print. |
| `functionTimeoutSecondsTransform` | string | -- | No | Transform producing timeout in seconds. |
| `requestIdTransform` | string | -- | No | Transform producing a request ID. Auto-generated when not provided. |

Standard output port.

**Validation:** requireInputNode

---

## Device Print Raw (Print Raw)

| | |
|---|---|
| **Name** | `devicePrintRaw` |
| **Title** | Print Raw |
| **Responsibility** | transition |
| **Description** | Sends raw commands (e.g., ZPL) to a printer through the MFGx Device Gateway. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `deviceIdTransform` | string | -- | Yes | The printer to send raw commands to. |
| `dataTransform` | string | -- | Yes | Transform producing the raw commands to send. |
| `filenameTransform` | string | -- | No | The name of the file. Defaults to a random ID. |
| `functionTimeoutSecondsTransform` | string | -- | No | Transform producing timeout in seconds. |
| `requestIdTransform` | string | -- | No | Transform producing a request ID. Auto-generated when not provided. |

Standard output port.

**Validation:** requireInputNode

---

## Device Subscription

| | |
|---|---|
| **Name** | `deviceSubscription` |
| **Title** | Device Subscription |
| **Responsibility** | source |
| **Description** | Subscribes to device subscriptions. Any dropdown left blank acts as a wildcard, allowing subscription to multiple devices or events with one node. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `deviceDriverType` | string | -- | No | The device driver type. |
| `driver` | string | -- | No | The device driver. |
| `device` | string | -- | No | The device. |
| `deviceGateway` | string | -- | No | The device gateway. |
| `deviceSubscriptionType` | string | -- | No | The device subscription type. |
| `deviceSubscription` | string | -- | No | The device subscription. |

Standard output port.

**Validation:** requireChangedName, requireOutputNode

---

## Tag Change Events -- *Deprecated*

| | |
|---|---|
| **Name** | `tagChanges` |
| **Title** | Tag Change Events |
| **Responsibility** | source |
| **Description** | Subscribes to new tag values for a specific tag. A more specific variant of the Data Changes node for tag change events. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `channelId` | integer | -- | No | Channel to filter the tag list by. Does not impact node behavior. |
| `tagId` | integer | -- | Yes | The tag to subscribe to value changes for. |

Standard output port (labeled "Tag Value").

**Validation:** requireChangedName, requireInputNode

---

## Get Tag Value -- *Deprecated*

| | |
|---|---|
| **Name** | `getTagValue` |
| **Title** | Get Tag Value |
| **Responsibility** | transition |
| **Description** | Retrieves the current value of a specific tag. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `channelId` | integer | -- | No | Channel to filter the tag list by. Does not impact node behavior. |
| `tagIdTransform` | string | jsonata | Yes | The tag to retrieve the value for. |

Standard output port (labeled "Tag Value").

**Validation:** requireChangedName, requireInputNode

---

## Set Tag Value -- *Deprecated*

| | |
|---|---|
| **Name** | `setTagValue` |
| **Title** | Set Tag Value |
| **Responsibility** | transition |
| **Description** | Sets the value of a specific tag. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `channelId` | string | -- | No | Channel to filter the tag list by. Does not impact node behavior. |
| `tagIdTransform` | string | jsonata | Yes | The tag to set the value for. |
| `valueTransform` | string | jsonata | No | Transform producing the new value of the tag. |
| `occurredAtTransform` | string | jsonata | No | Transform producing the time the tag value change occurred. Default: `$moment().format()`. |

Standard output port.

**Validation:** requireChangedName, requireInputNode

---

## Get Workcenter Production Mode -- *Deprecated*

| | |
|---|---|
| **Name** | `getWorkcenterMode` |
| **Title** | Get Workcenter Production Mode |
| **Responsibility** | transition |
| **Description** | Retrieves the current production mode of a specific workcenter. Deprecated: issue a query against the type instead. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `workcenterIdTransform` | string | jsonata | Yes | The workcenter to retrieve the mode for, or a transform producing the workcenter ID. |

Standard output port.

**Validation:** requireChangedName, requireInputNode

---

## Set Workcenter Production Mode -- *Deprecated*

| | |
|---|---|
| **Name** | `setWorkcenterMode` |
| **Title** | Set Workcenter Production Mode |
| **Responsibility** | transition |
| **Description** | Sets the production mode of a specific workcenter. Deprecated: issue a mutation against the type instead. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `workcenterIdTransform` | string | jsonata | Yes | The workcenter to set the mode for, or a transform producing the workcenter ID. |
| `productionModeIdTransform` | string | jsonata | Yes | The production mode to set, or a transform producing the production mode ID. |

Standard output port.

**Validation:** requireChangedName, requireInputNode

---

## Execute Device Function (Legacy) -- *Deprecated*

| | |
|---|---|
| **Name** | `executeDeviceFunction` |
| **Title** | Execute Device Function (Legacy) |
| **Responsibility** | transition |
| **Description** | Legacy version. Deprecated: use Execute Device Function V2 (`executeDeviceFunctionV2`) instead. |

### Properties

| Property | Type | Format | Required | Description |
|----------|------|--------|----------|-------------|
| `deviceIdTransform` | string | -- | Yes | The device to execute the function on. |
| `functionIdTransform` | string | -- | Yes | Which function to execute on the device. |
| `requestTransform` | string | -- | No | Transform producing the request payload. |
| `functionTimeoutSecondsTransform` | string | -- | No | Transform producing timeout in seconds. |
| `requestIdTransform` | string | -- | No | Transform producing a request ID. Auto-generated when not provided. |

Standard output port.

**Validation:** requireInputNode
