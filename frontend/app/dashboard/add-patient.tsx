import React, { useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { SafeAreaView, ScrollView, View, TextInput, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import cs from './commonStyles';
import { Title, Text, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import apiFetch, { createPatient, createOperation, getSurgeons } from '../../lib/apiClient';
import { useEffect } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function AddPatientScreen() {
  const router = useRouter();

  // Patient Details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('Male');
  const [bed, setBed] = useState('');
  const [ward, setWard] = useState('');

  // Surgery Details
  const [surgeryDate, setSurgeryDate] = useState('Select date');
  const [startTime, setStartTime] = useState('Start');
  const [endTime, setEndTime] = useState('End');
  const [surgeryDateObj, setSurgeryDateObj] = useState<Date | null>(null);
  const [startTimeObj, setStartTimeObj] = useState<Date | null>(null);
  const [endTimeObj, setEndTimeObj] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [anesthesia, setAnesthesia] = useState('General');
  const [procedure, setProcedure] = useState('');
  const [preOp, setPreOp] = useState('');
  const [postOp, setPostOp] = useState('');

  // Surgical Team
  const [surgeon, setSurgeon] = useState('');
  const [surgeonNameOther, setSurgeonNameOther] = useState('');
  const [surgeonsList, setSurgeonsList] = useState<Array<any>>([]);
  const [assistants, setAssistants] = useState('');
  const [anesthetist, setAnesthetist] = useState('');
  const [scrub, setScrub] = useState('');
  const [circulating, setCirculating] = useState('');

  // Outcome
  const [outcome, setOutcome] = useState('Successful');
  const [complications, setComplications] = useState('');
  const [remarks, setRemarks] = useState('');

  function handleSave() {
    setSaving(true);
    setError('');

    const payload = {
      firstName,
      lastName,
      patientId,
      age,
      sex,
      bed,
      ward,
      surgeryDate: surgeryDateObj ? surgeryDateObj.toISOString() : surgeryDate,
      startTime: startTimeObj ? startTimeObj.toISOString() : startTime,
      endTime: endTimeObj ? endTimeObj.toISOString() : endTime,
      anesthesia,
      procedure,
      preOp,
      postOp,
      surgeon,
      surgeonNameOther,
      assistants,
      anesthetist,
      scrub,
      circulating,
      outcome,
      complications,
      remarks,
    };
    // Create patient payload expected by backend
    const patientPayload: any = {
      firstName: firstName || '',
      lastName: lastName || '',
      dateOfBirth: null,
      medicalRecordNumber: patientId || undefined,
      contact: undefined,
      admissionDate:  new Date().toISOString().split('T')[0],
    };

    // Create patient then create operation that references the patient id
    (async () => {
      try {
        const patientRes = await createPatient(patientPayload);
  const createdPatient = patientRes.data || patientRes; // adapt to api shape
  const createdPatientId = createdPatient.id || createdPatient.docId || createdPatient.patientId;

        // Build operation payload
        const operationPayload: any = {
          patientId: createdPatientId,
          surgeonId: surgeon && surgeon !== 'other' ? surgeon : undefined,
          surgeon: surgeon === 'other' ? surgeonNameOther : undefined,
          nurseId: undefined,
          operationType: procedure || 'Unknown',
          operationDate: surgeryDateObj ? surgeryDateObj.toISOString() : (new Date()).toISOString(),
          scheduledStartTime: startTimeObj ? startTimeObj.toISOString() : undefined,
          actualStartTime: startTimeObj ? startTimeObj.toISOString() : undefined,
          actualEndTime: endTimeObj ? endTimeObj.toISOString() : undefined,
          operatingRoom: ward || undefined,
          anesthesiaType: anesthesia,
          anesthesiologist: anesthetist || undefined,
          assistantSurgeons: assistants ? assistants.split(',').map(s => s.trim()).filter(Boolean) : [],
          complications: complications || undefined,
          outcomes: outcome,
          notes: remarks || undefined,
          status: 'scheduled'
        };

        await createOperation(operationPayload);

        setSaving(false);
        // Navigate back to nurse dashboard or show success
        router.replace('/dashboard/nurse');
      } catch (err: any) {
        console.error('Save error', err);
        setError(err?.message || JSON.stringify(err));
        setSaving(false);
      }
    })();
  }

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getSurgeons();
        const data = res.data || res;
        if (!mounted) return;
        if (Array.isArray(data)) {
          setSurgeonsList(data.map(s => ({ id: s.id || s.uid || s._id, firstName: s.firstName || '', lastName: s.lastName || '' })));
        } else if (data && data.surgeons) {
          setSurgeonsList((data.surgeons || []).map((s: { id: any; uid: any; _id: any; firstName: any; lastName: any; }) => ({ id: s.id || s.uid || s._id, firstName: s.firstName || '', lastName: s.lastName || '' })));
        }
      } catch (err) {
        // silently ignore - surgeon list optional
        console.warn('Failed to fetch surgeons', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <ProtectedRoute requiredRole={["nurse", "surgeon"]}>
      <SafeAreaView style={cs.safe}>
        <ScrollView contentContainerStyle={cs.pageContainer}>
          <View style={cs.content}>
          <Title>New Surgery Record</Title>

          <View style={cs.section}>
            <Text style={cs.sectionTitle}>Patient Details</Text>
            <Text style={cs.label}>First Name *</Text>
            <TextInput placeholder="First name" value={firstName} onChangeText={setFirstName} style={cs.input} />

            <Text style={cs.label}>Last Name</Text>
            <TextInput placeholder="Last name" value={lastName} onChangeText={setLastName} style={cs.input} />

            <Text style={cs.label}>Patient ID *</Text>
            <TextInput placeholder="Patient ID" value={patientId} onChangeText={setPatientId} style={cs.input} />

            <Text style={cs.label}>Age</Text>
            <TextInput placeholder="Age" value={age} onChangeText={setAge} style={cs.input} keyboardType="numeric" />

            <Text style={cs.label}>Sex</Text>
            <View style={[cs.input, { paddingHorizontal: 0 }]}> 
              <Picker
                selectedValue={sex}
                onValueChange={(v: string) => setSex(v)}
                style={{ height: 44 }}
              >
                <Picker.Item label="Male" value="Male" />
                <Picker.Item label="Female" value="Female" />
              </Picker>
            </View>

            <Text style={cs.label}>Bed Number</Text>
            <TextInput placeholder="Bed number" value={bed} onChangeText={setBed} style={cs.input} />

            <Text style={cs.label}>Ward</Text>
            <TextInput placeholder="Ward" value={ward} onChangeText={setWard} style={cs.input} />
          </View>

          <View style={cs.section}>
            <Text style={cs.sectionTitle}>Surgery Details</Text>

            <Text style={cs.label}>Surgery Date *</Text>
            <Button
              mode="outlined"
              onPress={() => {
                if (Platform.OS === 'web') {
                  const v = window.prompt('Enter surgery date (YYYY-MM-DD)', surgeryDate === 'Select date' ? '' : surgeryDate);
                  if (v) {
                    const d = new Date(v);
                    if (!isNaN(d.getTime())) {
                      setSurgeryDateObj(d);
                      setSurgeryDate(d.toLocaleDateString());
                    }
                  }
                } else {
                  setShowDatePicker(true);
                }
              }}
            >
              {surgeryDateObj ? surgeryDateObj.toLocaleDateString() : surgeryDate}
            </Button>

            {showDatePicker && (
              <DateTimePicker
                value={surgeryDateObj || new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setSurgeryDateObj(selectedDate);
                    setSurgeryDate(selectedDate.toLocaleDateString());
                  }
                }}
              />
            )}

            <Text style={[cs.label, { marginTop: 8 }]}>Start Time *</Text>
            <Button
              mode="outlined"
              onPress={() => {
                if (Platform.OS === 'web') {
                  const v = window.prompt('Enter start time (HH:MM, 24h)', startTime === 'Start' ? '' : startTime);
                  if (v) {
                    const [hh, mm] = v.split(':').map(Number);
                    const d = new Date();
                    d.setHours(hh ?? 0, mm ?? 0, 0, 0);
                    setStartTimeObj(d);
                    setStartTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                  }
                } else {
                  setShowStartPicker(true);
                }
              }}
            >
              {startTimeObj ? startTimeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : startTime}
            </Button>

            {showStartPicker && (
              <DateTimePicker
                value={startTimeObj || new Date()}
                mode="time"
                display="default"
                onChange={(event, selectedTime) => {
                  setShowStartPicker(false);
                  if (selectedTime) {
                    setStartTimeObj(selectedTime);
                    setStartTime(selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                  }
                }}
              />
            )}

            <Text style={[cs.label, { marginTop: 8 }]}>End Time *</Text>
            <Button
              mode="outlined"
              onPress={() => {
                if (Platform.OS === 'web') {
                  const v = window.prompt('Enter end time (HH:MM, 24h)', endTime === 'End' ? '' : endTime);
                  if (v) {
                    const [hh, mm] = v.split(':').map(Number);
                    const d = new Date();
                    d.setHours(hh ?? 0, mm ?? 0, 0, 0);
                    setEndTimeObj(d);
                    setEndTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                  }
                } else {
                  setShowEndPicker(true);
                }
              }}
            >
              {endTimeObj ? endTimeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : endTime}
            </Button>

            {showEndPicker && (
              <DateTimePicker
                value={endTimeObj || new Date()}
                mode="time"
                display="default"
                onChange={(event, selectedTime) => {
                  setShowEndPicker(false);
                  if (selectedTime) {
                    setEndTimeObj(selectedTime);
                    setEndTime(selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                  }
                }}
              />
            )}

            <Text style={cs.label}>Anesthesia Type *</Text>
            <View style={[cs.input, { paddingHorizontal: 0 }]}> 
              <Picker
                selectedValue={anesthesia}
                onValueChange={(v: string) => setAnesthesia(v)}
                style={{ height: 44 }}
              >
                <Picker.Item label="General" value="General" />
                <Picker.Item label="Regional" value="Regional" />
                <Picker.Item label="Local" value="Local" />
                <Picker.Item label="Sedation" value="Sedation" />
              </Picker>
            </View>

            <Text style={cs.label}>Procedure Performed *</Text>
            <TextInput placeholder="Procedure performed" value={procedure} onChangeText={setProcedure} style={cs.input} />

            <Text style={cs.label}>Pre-Op Diagnosis *</Text>
            <TextInput placeholder="Pre-op diagnosis" value={preOp} onChangeText={setPreOp} style={cs.input} />

            <Text style={cs.label}>Post-Op Diagnosis</Text>
            <TextInput placeholder="Post-op diagnosis" value={postOp} onChangeText={setPostOp} style={cs.input} />
          </View>

          <View style={cs.section}>
            <Text style={cs.sectionTitle}>Surgical Team</Text>
            <Text style={cs.label}>Surgeon *</Text>
            <View style={[cs.input, { paddingHorizontal: 0 }]}> 
              <Picker
                selectedValue={surgeon}
                onValueChange={(v: string) => setSurgeon(v)}
                style={{ height: 44 }}
              >
                <Picker.Item label="Select surgeon" value="" />
                {surgeonsList.map(s => (
                  <Picker.Item key={s.id} label={`${s.firstName} ${s.lastName}`} value={s.id} />
                ))}
                <Picker.Item label="Other (type name)" value="other" />
              </Picker>
            </View>
            {surgeon === 'other' && (
              <TextInput placeholder="Enter surgeon name" value={surgeonNameOther} onChangeText={setSurgeonNameOther} style={cs.input} />
            )}

            <Text style={cs.label}>Assistants (comma-separated)</Text>
            <TextInput placeholder="Assistants (comma-separated)" value={assistants} onChangeText={setAssistants} style={cs.input} />

            <Text style={cs.label}>Anesthetist</Text>
            <TextInput placeholder="Anesthetist" value={anesthetist} onChangeText={setAnesthetist} style={cs.input} />

            <Text style={cs.label}>Scrub Nurse</Text>
            <TextInput placeholder="Scrub nurse" value={scrub} onChangeText={setScrub} style={cs.input} />

            <Text style={cs.label}>Circulating Nurse</Text>
            <TextInput placeholder="Circulating nurse" value={circulating} onChangeText={setCirculating} style={cs.input} />
          </View>

          <View style={cs.section}>
            <Text style={cs.sectionTitle}>Outcome</Text>
            <Text style={cs.label}>Outcome *</Text>
            <View style={[cs.input, { paddingHorizontal: 0 }]}> 
              <Picker
                selectedValue={outcome}
                onValueChange={(v: string) => setOutcome(v)}
                style={{ height: 44 }}
              >
                <Picker.Item label="Successful" value="Successful" />
                <Picker.Item label="Unsuccessful" value="Unsuccessful" />
                <Picker.Item label="Pending" value="Pending" />
              </Picker>
            </View>

            <Text style={cs.label}>Complications</Text>
            <TextInput placeholder="Complications" value={complications} onChangeText={setComplications} style={[cs.input, { height: 90, textAlignVertical: 'top' }]} multiline />

            <Text style={cs.label}>Remarks</Text>
            <TextInput placeholder="Remarks" value={remarks} onChangeText={setRemarks} style={[cs.input, { height: 90, textAlignVertical: 'top' }]} multiline />
          </View>

          <View style={[cs.actionsRow, { width: '80%', alignSelf: 'center' }]}> 
            <View style={{ flex: 1, marginRight: 8 }}>
              <Button mode="contained" onPress={handleSave} contentStyle={{ height: 44 }} style={{ width: '100%' }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button mode="outlined" onPress={() => router.back()} contentStyle={{ height: 44 }} style={{ width: '100%' }}>Cancel</Button>
            </View>
          </View>
          {error ? <Text style={{ color: 'red', alignSelf: 'center', marginTop: 8 }}>{error}</Text> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ProtectedRoute>
  );
}
